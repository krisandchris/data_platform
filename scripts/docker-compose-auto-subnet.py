#!/usr/bin/env python3
"""Run docker compose with an automatically selected non-overlapping 172.x subnet."""

from __future__ import annotations

import ipaddress
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Iterable


DEFAULT_POOL = "172.16.0.0/12"
DEFAULT_PREFIX = 24


def die(message: str) -> None:
    print(f"[docker-compose-auto-subnet] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def info(message: str) -> None:
    print(f"[docker-compose-auto-subnet] {message}", file=sys.stderr)


def run_text(command: list[str]) -> str:
    try:
        result = subprocess.run(
            command,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError:
        die(f"missing required command: {command[0]}")
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip()
        die(f"command failed: {' '.join(command)}{f': {detail}' if detail else ''}")
    return result.stdout


def parse_network(value: str) -> ipaddress.IPv4Network | None:
    try:
        network = ipaddress.ip_network(value, strict=False)
    except ValueError:
        return None
    if isinstance(network, ipaddress.IPv4Network):
        return network
    return None


def docker_network_inspect() -> list[dict[str, object]]:
    network_ids = [line.strip() for line in run_text(["docker", "network", "ls", "-q"]).splitlines()]
    network_ids = [network_id for network_id in network_ids if network_id]
    if not network_ids:
        return []

    networks: list[dict[str, object]] = []
    for offset in range(0, len(network_ids), 50):
        payload = run_text(["docker", "network", "inspect", *network_ids[offset : offset + 50]])
        networks.extend(json.loads(payload))
    return networks


def subnet_configs(item: dict[str, object]) -> Iterable[ipaddress.IPv4Network]:
    ipam = item.get("IPAM")
    if not isinstance(ipam, dict):
        return []
    configs = ipam.get("Config") or []
    if not isinstance(configs, list):
        return []

    networks: list[ipaddress.IPv4Network] = []
    for config in configs:
        if not isinstance(config, dict):
            continue
        subnet = config.get("Subnet")
        if not isinstance(subnet, str):
            continue
        network = parse_network(subnet)
        if network is not None:
            networks.append(network)
    return networks


def docker_networks(inspected: list[dict[str, object]]) -> list[ipaddress.IPv4Network]:
    networks: list[ipaddress.IPv4Network] = []
    for item in inspected:
        networks.extend(subnet_configs(item))
    return networks


def compose_project_name(root: Path) -> str:
    return os.environ.get("COMPOSE_PROJECT_NAME", root.name)


def existing_project_subnet(root: Path, inspected: list[dict[str, object]]) -> ipaddress.IPv4Network | None:
    project = compose_project_name(root)
    expected_name = f"{project}_platform"

    for item in inspected:
        labels = item.get("Labels") or {}
        if not isinstance(labels, dict):
            labels = {}
        name = item.get("Name")
        is_project_network = (
            name == expected_name
            or (
                labels.get("com.docker.compose.project") == project
                and labels.get("com.docker.compose.network") == "platform"
            )
        )
        if not is_project_network:
            continue
        for subnet in subnet_configs(item):
            return subnet
    return None


def host_route_networks() -> list[ipaddress.IPv4Network]:
    if not shutil.which("ip"):
        return []

    networks: list[ipaddress.IPv4Network] = []
    try:
        payload = run_text(["ip", "-j", "route", "show"])
        for item in json.loads(payload):
            destination = item.get("dst")
            if isinstance(destination, str) and destination != "default":
                network = parse_network(destination)
                if network is not None:
                    networks.append(network)
        return networks
    except SystemExit:
        return []
    except json.JSONDecodeError:
        return []


def used_networks(inspected: list[dict[str, object]]) -> list[ipaddress.IPv4Network]:
    networks = docker_networks(inspected)
    networks.extend(host_route_networks())
    unique: dict[str, ipaddress.IPv4Network] = {}
    for network in networks:
        unique[str(network)] = network
    return list(unique.values())


def preferred_candidates(
    pool: ipaddress.IPv4Network, prefix: int
) -> Iterable[ipaddress.IPv4Network]:
    second_octet_order = {
        octet: index
        for index, octet in enumerate([30, 31, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 16, 17])
    }

    third_octet_order = {
        octet: index
        for index, octet in enumerate(
            [
                *range(240, 255),
                *range(200, 240),
                *range(128, 200),
                *range(64, 128),
                *range(2, 64),
                1,
                0,
            ]
        )
    }

    def rank(network: ipaddress.IPv4Network) -> tuple[int, int, int]:
        octets = str(network.network_address).split(".")
        second = int(octets[1])
        third = int(octets[2])
        return (
            second_octet_order.get(second, 99),
            third_octet_order.get(third, 999),
            int(octets[3]),
        )

    return sorted(pool.subnets(new_prefix=prefix), key=rank)


def select_subnet(root: Path) -> ipaddress.IPv4Network:
    explicit = os.environ.get("PLATFORM_DOCKER_SUBNET", "").strip()
    if explicit:
        network = parse_network(explicit)
        if network is None:
            die(f"invalid PLATFORM_DOCKER_SUBNET: {explicit}")
        return network

    inspected = docker_network_inspect()
    existing_subnet = existing_project_subnet(root, inspected)
    if existing_subnet is not None:
        return existing_subnet

    pool = parse_network(os.environ.get("PLATFORM_DOCKER_SUBNET_POOL", DEFAULT_POOL))
    if pool is None:
        die(f"invalid PLATFORM_DOCKER_SUBNET_POOL: {os.environ.get('PLATFORM_DOCKER_SUBNET_POOL')}")

    prefix_text = os.environ.get("PLATFORM_DOCKER_SUBNET_PREFIX", str(DEFAULT_PREFIX))
    try:
        prefix = int(prefix_text)
    except ValueError:
        die(f"invalid PLATFORM_DOCKER_SUBNET_PREFIX: {prefix_text}")
    if prefix < pool.prefixlen or prefix > 30:
        die(f"PLATFORM_DOCKER_SUBNET_PREFIX must be between {pool.prefixlen} and 30")

    occupied = used_networks(inspected)
    for candidate in preferred_candidates(pool, prefix):
        if all(not candidate.overlaps(network) for network in occupied):
            return candidate

    occupied_preview = ", ".join(str(network) for network in sorted(occupied, key=str)[:20])
    die(f"no available subnet in {pool} with /{prefix}; occupied includes: {occupied_preview}")


def usage() -> None:
    print(
        """Usage:
  scripts/docker-compose-auto-subnet.py print-subnet
  scripts/docker-compose-auto-subnet.py list-used
  scripts/docker-compose-auto-subnet.py <docker compose args...>

Examples:
  scripts/docker-compose-auto-subnet.py list-used
  scripts/docker-compose-auto-subnet.py build
  scripts/docker-compose-auto-subnet.py up -d --build
  scripts/docker-compose-auto-subnet.py down

Environment overrides:
  PLATFORM_DOCKER_SUBNET=172.30.250.0/24      Use a manually selected subnet.
  PLATFORM_DOCKER_SUBNET_POOL=172.16.0.0/12   Candidate pool for automatic selection.
  PLATFORM_DOCKER_SUBNET_PREFIX=24            Candidate subnet size.
""".rstrip()
    )


def main(argv: list[str]) -> int:
    if not argv or argv[0] in {"-h", "--help", "help"}:
        usage()
        return 0 if argv else 2

    root = Path(__file__).resolve().parents[1]
    subnet = select_subnet(root)
    if argv[0] == "print-subnet":
        print(subnet)
        return 0
    if argv[0] == "list-used":
        inspected = docker_network_inspect()
        for network in sorted(used_networks(inspected), key=lambda item: int(item.network_address)):
            print(network)
        return 0

    env = os.environ.copy()
    env["PLATFORM_DOCKER_SUBNET"] = str(subnet)
    info(f"using PLATFORM_DOCKER_SUBNET={subnet}")
    return subprocess.call(["docker", "compose", *argv], cwd=root, env=env)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
