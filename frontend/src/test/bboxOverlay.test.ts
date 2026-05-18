import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import BBoxOverlay from '../shared/components/BBoxOverlay.vue';

describe('BBoxOverlay', () => {
  it('scales 0-1000 quantized coordinates into percentages', () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 1280,
        imageHeight: 720,
        boxes: [
          {
            id: 'box-1',
            label: 'R1',
            bbox: [250, 250, 500, 500],
          },
        ],
      },
    });

    const box = wrapper.find('.bbox-shell__box');

    expect(box.attributes('style')).toContain('left: 25%');
    expect(box.attributes('style')).toContain('top: 25%');
    expect(box.attributes('style')).toContain('width: 25%');
    expect(box.attributes('style')).toContain('height: 25%');
    expect(box.text()).toBe('');
    expect(box.attributes('aria-label')).toBe('R1');
  });

  it('keeps quantized bbox placement independent from source image resolution', () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 1920,
        imageHeight: 1080,
        boxes: [
          {
            id: 'box-wide',
            label: 'wide',
            bbox: [500, 250, 750, 500],
          },
        ],
      },
    });

    const box = wrapper.find('.bbox-shell__box');

    expect(box.attributes('style')).toContain('left: 50%');
    expect(box.attributes('style')).toContain('top: 25%');
    expect(box.attributes('style')).toContain('width: 25%');
    expect(box.attributes('style')).toContain('height: 25%');
  });

  it('zooms the image stage with the mouse wheel while keeping bbox coordinates stable', async () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 1280,
        imageHeight: 720,
        boxes: [
          {
            id: 'box-zoom',
            label: 'R1',
            bbox: [250, 250, 500, 500],
          },
        ],
      },
    });

    const stage = wrapper.find('.bbox-shell__stage').element as HTMLElement;
    stage.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }) as DOMRect;

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      clientX: 25,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });
    wrapper.find('.bbox-shell').element.dispatchEvent(wheelEvent);
    await nextTick();

    expect(stage.getAttribute('style')).toContain('transform: scale(1.12)');
    expect(stage.getAttribute('style')).toContain('transform-origin: 25% 50%');

    const box = wrapper.find('.bbox-shell__box');
    expect(box.attributes('style')).toContain('left: 25%');
    expect(box.attributes('style')).toContain('top: 25%');
    expect(box.attributes('style')).toContain('width: 25%');
    expect(box.attributes('style')).toContain('height: 25%');
  });

  it('emits the selected box when an overlay box is clicked', async () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 1280,
        imageHeight: 720,
        boxes: [
          {
            id: 'box-2',
            label: 'R2',
            bbox: [100, 100, 260, 260],
            relationIndex: 'R2',
            selected: true,
          },
        ],
      },
    });

    await wrapper.find('.bbox-shell__box').trigger('click');

    expect(wrapper.emitted('selectBox')?.[0]?.[0]).toMatchObject({
      id: 'box-2',
      relationIndex: 'R2',
    });
  });

  it('emits edited 0-1000 coordinates when an editable box is dragged on the preview stage', async () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 1280,
        imageHeight: 720,
        boxes: [
          {
            id: 'box-3',
            label: 'R3',
            bbox: [100, 100, 300, 300],
            relationIndex: 'R3',
            editable: true,
          },
        ],
      },
    });

    const stage = wrapper.find('.bbox-shell__stage').element as HTMLElement;
    stage.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }) as DOMRect;

    await wrapper.find('.bbox-shell__box').trigger('pointerdown', {
      clientX: 10,
      clientY: 10,
    });

    const moveEvent = new Event('pointermove') as PointerEvent;
    Object.defineProperty(moveEvent, 'clientX', { value: 20 });
    Object.defineProperty(moveEvent, 'clientY', { value: 15 });
    window.dispatchEvent(moveEvent);
    window.dispatchEvent(new Event('pointerup'));

    expect(wrapper.emitted('updateBox')?.[0]?.[0]).toMatchObject({
      id: 'box-3',
      relationIndex: 'R3',
    });
    expect(wrapper.emitted('updateBox')?.[0]?.[1]).toEqual([200, 150, 400, 350]);
  });

  it('emits edited 0-1000 coordinates when an editable box is resized on the preview stage', async () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 1280,
        imageHeight: 720,
        boxes: [
          {
            id: 'box-4',
            label: 'R4',
            bbox: [100, 100, 300, 300],
            relationIndex: 'R4',
            editable: true,
          },
        ],
      },
    });

    const stage = wrapper.find('.bbox-shell__stage').element as HTMLElement;
    stage.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }) as DOMRect;

    await wrapper.find('.bbox-shell__resize').trigger('pointerdown', {
      clientX: 30,
      clientY: 30,
    });

    const moveEvent = new Event('pointermove') as PointerEvent;
    Object.defineProperty(moveEvent, 'clientX', { value: 35 });
    Object.defineProperty(moveEvent, 'clientY', { value: 42 });
    window.dispatchEvent(moveEvent);
    window.dispatchEvent(new Event('pointerup'));

    expect(wrapper.emitted('updateBox')?.[0]?.[0]).toMatchObject({
      id: 'box-4',
      relationIndex: 'R4',
    });
    expect(wrapper.emitted('updateBox')?.[0]?.[1]).toEqual([100, 100, 350, 420]);
  });
});
