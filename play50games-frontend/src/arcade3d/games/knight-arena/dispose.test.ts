// Dummy fallback meshes are freed on unmount (Retry remounts the scene).
import { createElement, type ReactNode } from "react";
import ReactReconciler from "react-reconciler";
import { BufferGeometry, Material } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dummies } from "./Dummies";

vi.mock("@react-three/fiber", () => ({ useFrame: () => {} }));
vi.mock("../../core/assets", () => ({ DynamicInstancedModel: () => null }));

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

describe("knight-arena dummy dispose", () => {
   it("disposes fallback geometries and materials on unmount", () => {
      const geometries = vi.spyOn(BufferGeometry.prototype, "dispose");
      const materials = vi.spyOn(Material.prototype, "dispose");
      const runRef = { current: null as never };
      const unmount = mount(createElement(Dummies, { runRef }));
      expect(geometries).not.toHaveBeenCalled();
      expect(materials).not.toHaveBeenCalled();
      unmount();
      // 3 stand-in parts + disc, ring, arrow, shield, tomato
      expect(geometries).toHaveBeenCalledTimes(8);
      expect(materials).toHaveBeenCalledTimes(8);
   });
});
