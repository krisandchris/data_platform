import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import BBoxOverlay from '../shared/components/BBoxOverlay.vue';

describe('BBoxOverlay', () => {
  const domRect = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => undefined,
    }) as DOMRect;

  const dispatchPointerMove = (clientX: number, clientY: number) => {
    const moveEvent = new Event('pointermove', { cancelable: true }) as PointerEvent;
    Object.defineProperty(moveEvent, 'clientX', { value: clientX });
    Object.defineProperty(moveEvent, 'clientY', { value: clientY });
    window.dispatchEvent(moveEvent);
  };

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

  it('keeps the previous image and boxes visible until the next image loads', async () => {
    const originalImage = window.Image;
    const pendingImages: Array<{ onload: (() => void) | null; onerror: (() => void) | null; src: string; complete: boolean }> = [];
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = false;
      private imageSrc = '';

      set src(value: string) {
        this.imageSrc = value;
        pendingImages.push(this);
      }

      get src() {
        return this.imageSrc;
      }
    }

    vi.stubGlobal('Image', MockImage);
    Object.defineProperty(window, 'Image', {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    try {
      const wrapper = mount(BBoxOverlay, {
        props: {
          imageUrl: '/api/media/sample-1',
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

      await wrapper.setProps({
        imageUrl: '/api/media/sample-2',
        boxes: [
          {
            id: 'box-2',
            label: 'R2',
            bbox: [100, 100, 300, 300],
          },
        ],
      });
      await nextTick();

      expect(wrapper.find('img').attributes('src')).toContain('/api/media/sample-1');
      expect(wrapper.find('.bbox-shell__box').attributes('aria-label')).toBe('R1');
      expect(wrapper.find('.bbox-shell__box').attributes('tabindex')).toBe('-1');
      expect(wrapper.find('.bbox-shell__image-status').text()).toContain('正在加载图像');
      await wrapper.find('.bbox-shell__box').trigger('click');
      expect(wrapper.emitted('selectBox')).toBeUndefined();

      pendingImages[0].complete = true;
      pendingImages[0].onload?.();
      await nextTick();

      expect(wrapper.find('img').attributes('src')).toContain('/api/media/sample-2');
      expect(wrapper.find('.bbox-shell__box').attributes('aria-label')).toBe('R2');
      expect(wrapper.find('.bbox-shell__box').attributes('tabindex')).toBe('0');
      expect(wrapper.find('.bbox-shell__image-status').exists()).toBe(false);
    } finally {
      Object.defineProperty(window, 'Image', {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      vi.unstubAllGlobals();
    }
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

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      clientX: 640,
      clientY: 360,
      bubbles: true,
      cancelable: true,
    });
    wrapper.find('.bbox-shell').element.dispatchEvent(wheelEvent);
    await nextTick();

    expect(stage.getAttribute('style')).toContain('scale(1.12)');
    expect(stage.getAttribute('style')).toContain('translate(-76.8px, -43.2px)');
    expect(stage.getAttribute('style')).toContain('transform-origin: 0 0');

    const box = wrapper.find('.bbox-shell__box');
    expect(box.attributes('style')).toContain('left: 25%');
    expect(box.attributes('style')).toContain('top: 25%');
    expect(box.attributes('style')).toContain('width: 25%');
    expect(box.attributes('style')).toContain('height: 25%');
  });

  it('pans the zoomed image stage with the mouse middle button', async () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 100,
        imageHeight: 100,
        boxes: [
          {
            id: 'box-pan',
            label: 'R1',
            bbox: [250, 250, 500, 500],
          },
        ],
      },
    });

    const shell = wrapper.find('.bbox-shell');
    const stage = wrapper.find('.bbox-shell__stage').element as HTMLElement;

    shell.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 50,
        clientY: 50,
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();
    const zoomedStyle = stage.getAttribute('style') ?? '';
    expect(zoomedStyle).toContain('scale(1.12)');

    await shell.trigger('pointerdown', {
      button: 1,
      buttons: 4,
      clientX: 50,
      clientY: 50,
    });
    dispatchPointerMove(46, 46);
    window.dispatchEvent(new Event('pointerup'));
    await nextTick();

    expect(stage.getAttribute('style')).toContain('translate(-10px, -10px)');
    expect(stage.getAttribute('style')).toContain('scale(1.12)');
  });

  it('keeps the fitted image centered when middle dragging at 1x zoom', async () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 100,
        imageHeight: 100,
        boxes: [
          {
            id: 'box-no-pan',
            label: 'R1',
            bbox: [250, 250, 500, 500],
          },
        ],
      },
    });

    const shell = wrapper.find('.bbox-shell');
    const stage = wrapper.find('.bbox-shell__stage').element as HTMLElement;

    await shell.trigger('pointerdown', {
      button: 1,
      buttons: 4,
      clientX: 50,
      clientY: 50,
    });
    dispatchPointerMove(30, 30);
    window.dispatchEvent(new Event('pointerup'));
    await nextTick();

    expect(stage.getAttribute('style')).toContain('translate(0px, 0px) scale(1)');
  });

  it('pans instead of selecting or editing when the middle button starts over a bbox', async () => {
    const wrapper = mount(BBoxOverlay, {
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 100,
        imageHeight: 100,
        boxes: [
          {
            id: 'box-middle-on-bbox',
            label: 'R1',
            bbox: [250, 250, 500, 500],
            editable: true,
          },
        ],
      },
    });

    const shell = wrapper.find('.bbox-shell');
    const stage = wrapper.find('.bbox-shell__stage').element as HTMLElement;

    shell.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 50,
        clientY: 50,
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();

    await wrapper.find('.bbox-shell__box').trigger('pointerdown', {
      button: 1,
      buttons: 4,
      clientX: 50,
      clientY: 50,
    });
    dispatchPointerMove(46, 46);
    window.dispatchEvent(new Event('pointerup'));
    await nextTick();

    expect(wrapper.emitted('selectBox')).toBeUndefined();
    expect(wrapper.emitted('updateBox')).toBeUndefined();
    expect(stage.getAttribute('style')).toContain('translate(-10px, -10px)');
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

  it('keeps selected boxes at the default 2px border width and changes only color', () => {
    const wrapper = mount(BBoxOverlay, {
      attachTo: document.body,
      props: {
        imageUrl: '/api/media/sample',
        imageWidth: 1280,
        imageHeight: 720,
        boxes: [
          {
            id: 'box-selected',
            label: 'R1',
            bbox: [100, 100, 260, 260],
            selected: true,
          },
        ],
      },
    });

    const selectedBox = wrapper.find('.bbox-shell__box--selected').element;
    const computed = getComputedStyle(selectedBox);

    expect(computed.borderTopWidth).toBe('2px');
    expect(computed.borderTopColor).toBe('rgb(255, 59, 48)');

    wrapper.unmount();
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
    stage.getBoundingClientRect = () => domRect(0, 0, 100, 100);

    await wrapper.find('.bbox-shell__box').trigger('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
    });

    dispatchPointerMove(20, 15);
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
    stage.getBoundingClientRect = () => domRect(0, 0, 100, 100);

    await wrapper.find('.bbox-shell__resize').trigger('pointerdown', {
      button: 0,
      clientX: 30,
      clientY: 30,
    });

    dispatchPointerMove(35, 42);
    window.dispatchEvent(new Event('pointerup'));

    expect(wrapper.emitted('updateBox')?.[0]?.[0]).toMatchObject({
      id: 'box-4',
      relationIndex: 'R4',
    });
    expect(wrapper.emitted('updateBox')?.[0]?.[1]).toEqual([100, 100, 350, 420]);
  });
});
