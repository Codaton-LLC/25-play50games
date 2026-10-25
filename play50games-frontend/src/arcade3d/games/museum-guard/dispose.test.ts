// Gallery geometries are freed on unmount (Retry remounts the scene).
import { createElement, type ReactNode } from "react";
import ReactReconciler from "react-reconciler";
import { BufferGeometry } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import Gallery, { useOwnedGeometry } from "./Gallery";

vi.mock("@react-three/fiber", () => ({ useFrame: () => {} }));
vi.mock("@/arcade3d/core/gameTime", () => ({
   useGameTime: () => ({ now: 0, delta: 0, play: 0 }),
}));
vi.mock("@/arcade3d/core/render/useCanvasTexture", () => ({
   useCanvasTexture: () => ({
      wrapS: 0,
      repeat: { set() {} },
      offset: { set() {} },
      needsUpdate: false,
      dispose() {},
   }),
}));
vi.mock("@/arcade3d/core/assets", () => ({
   Model: () => null,
   InstancedModel: () => null,
}));

interface RootHandle {
   createContainer(
      containerInfo: object,
      tag: number,
      hydrationCallbacks: null,
      isStrictMode: boolean,
      concurrentUpdatesByDefaultOverride: null,
      identifierPrefix: string,
      onRecoverableError: (error: Error) => void,
      transitionCallbacks: null,
   ): object;
   updateContainer(element: ReactNode, container: object, parent: null, callback: null): void;
   flushPassiveEffects(): void;
}

const HOST = {
   supportsMutation: true,
   isPrimaryRenderer: false,
   supportsPersistence: false,
   supportsHydration: false,
   noTimeout: -1,
   scheduleTimeout: setTimeout,
   cancelTimeout: clearTimeout,
   createInstance() {
      return {
         setMatrixAt() {},
         setColorAt() {},
         instanceMatrix: { needsUpdate: false },
         instanceColor: null,
         computeBoundingSphere() {},
      };
   },
   createTextInstance() { return {}; },
   appendInitialChild() {},
   appendChild() {},
   appendChildToContainer() {},
   removeChild() {},
   removeChildFromContainer() {},
   insertBefore() {},
   insertInContainerBefore() {},
   prepareUpdate() { return null; },
   commitUpdate() {},
   commitTextUpdate() {},
   finalizeInitialChildren() { return false; },
   commitMount() {},
   prepareForCommit() { return null; },
   resetAfterCommit() {},
   getRootHostContext() { return {}; },
   getChildHostContext(parent: object) { return parent; },
   shouldSetTextContent() { return false; },
   getPublicInstance(instance: object) { return instance; },
   clearContainer() {},
   preparePortalMount() {},
   hideInstance() {},
   hideTextInstance() {},
   unhideInstance() {},
   unhideTextInstance() {},
   getCurrentEventPriority() { return 16; },
   beforeActiveInstanceBlur() {},
   afterActiveInstanceBlur() {},
   detachDeletedInstance() {},
   now: Date.now,
};

function mount(node: ReactNode): () => void {
   const reconciler = ReactReconciler(HOST as never) as RootHandle;
   let failed: Error | null = null;
   const root = reconciler.createContainer({}, 0, null, false, null, "", (error) => {
      failed = error;
   }, null);
   reconciler.updateContainer(node, root, null, null);
   reconciler.flushPassiveEffects();
   if (failed) throw failed;
   return () => {
      failed = null;
      reconciler.updateContainer(null, root, null, null);
      reconciler.flushPassiveEffects();
      if (failed) throw failed;
   };
}

afterEach(() => {
   vi.restoreAllMocks();
});

describe("museum-guard gallery dispose", () => {
   it("calls dispose on unmount for a mocked geometry", () => {
      const geometry = { dispose: vi.fn() };
      function Probe() {
         useOwnedGeometry(() => geometry);
         return null;
      }
      const unmount = mount(createElement(Probe));
      expect(geometry.dispose).not.toHaveBeenCalled();
      unmount();
      expect(geometry.dispose).toHaveBeenCalledTimes(1);
   });

   it("disposes the room geometries on unmount, and the merge inputs while building", () => {
      const spy = vi.spyOn(BufferGeometry.prototype, "dispose");
      const unmount = mount(createElement(Gallery, { yaw: { current: 0 } }));
      const inputs = spy.mock.calls.length;
      expect(inputs).toBeGreaterThan(8);
      spy.mockClear();
      unmount();
      // pedestal, vase, paintings, fixtures, wash, post, rope, motes
      expect(spy).toHaveBeenCalledTimes(8);
   });
});
