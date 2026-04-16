const APPLE_TOUCH_DEVICE_REGEX = /iPad|iPhone|iPod/i;
const SAFARI_REGEX = /Safari/i;
const NON_SAFARI_REGEX = /Chrome|CriOS|FxiOS|Edg|OPR|OPiOS|Firefox/i;

export function isEditableElement(
  element: Element | null,
): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;

  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable ||
    element.getAttribute("contenteditable") === "true" ||
    element.getAttribute("role") === "textbox" ||
    element.getAttribute("role") === "combobox"
  );
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && isEditableElement(target);
}

export function describeElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return {};
  }

  return {
    target_tag: element.tagName.toLowerCase(),
    target_id: element.id || undefined,
    target_name: element.getAttribute("name") || undefined,
    target_role: element.getAttribute("role") || undefined,
    target_debug_id: element.getAttribute("data-debug-id") || undefined,
    target_contenteditable: element.getAttribute("contenteditable") || undefined,
    target_type:
      element instanceof HTMLInputElement ? element.type : undefined,
    target_placeholder:
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
        ? element.placeholder || undefined
        : undefined,
  };
}

export function getClientDiagnosticsContext() {
  if (typeof window === "undefined") {
    return {};
  }

  const visualViewport = window.visualViewport;
  const userAgent = navigator.userAgent;
  const isAppleTouchDevice =
    APPLE_TOUCH_DEVICE_REGEX.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = SAFARI_REGEX.test(userAgent) && !NON_SAFARI_REGEX.test(userAgent);

  return {
    path: window.location.pathname,
    platform: navigator.platform,
    user_agent: userAgent,
    language: navigator.language,
    max_touch_points: navigator.maxTouchPoints,
    inner_width: window.innerWidth,
    inner_height: window.innerHeight,
    outer_width: window.outerWidth,
    outer_height: window.outerHeight,
    screen_width: window.screen?.width,
    screen_height: window.screen?.height,
    device_pixel_ratio: window.devicePixelRatio,
    visual_viewport_width: visualViewport
      ? Math.round(visualViewport.width)
      : undefined,
    visual_viewport_height: visualViewport
      ? Math.round(visualViewport.height)
      : undefined,
    visual_viewport_offset_top: visualViewport
      ? Math.round(visualViewport.offsetTop)
      : undefined,
    visual_viewport_offset_left: visualViewport
      ? Math.round(visualViewport.offsetLeft)
      : undefined,
    orientation: window.screen?.orientation?.type,
    is_apple_touch_device: isAppleTouchDevice,
    is_safari: isSafari,
    is_standalone:
      window.matchMedia?.("(display-mode: standalone)")?.matches ?? false,
  };
}
