import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, CHARACTER_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
const prop = (id: string): ModelAsset => ({ id, url: `/models/3d/temple-lantern-jump/${id}.glb`, fallback: "box", fallbackColor: "#b6a779", budget: PROP_BUDGET });
export const ASSETS = {
   hero: heroModelAsset("kiro"),
   lantern: prop("m2StoneCageLantern"), deck: prop("m2LanternDeck"), ledge: prop("m2TempleLedge"),
   beam: prop("m2TempleBeam"), balcony: prop("m2WoodenBalconyV2"), brazier: prop("m2StoneBrazier"),
   roof: prop("m2RuinRoofSection"), tower: prop("m2TempleTowerBg"),
   bat: { id: "m2CaveBat", url: "/models/3d/menu2/m2CaveBat.glb", fallback: "sphere", fallbackColor: "#504758", budget: CHARACTER_BUDGET } as ModelAsset,
};
export const BOUNDS = {
   "m2LanternDeck": {
      "min": [
         -0.4688798189163208,
         -0.9517993330955505,
         -0.45190975069999695
      ],
      "size": [
         0.9355045557022095,
         1.8971420526504517,
         0.8971698880195618
      ]
   },
   "m2RuinRoofSection": {
      "min": [
         -0.9512236714363098,
         -0.3933609127998352,
         -0.8227490186691284
      ],
      "size": [
         1.8991872072219849,
         0.7918912768363953,
         1.653970718383789
      ]
   },
   "m2StoneBrazier": {
      "min": [
         -0.9477816820144653,
         -0.5188472270965576,
         -0.9402679204940796
      ],
      "size": [
         1.8963100910186768,
         1.0488615036010742,
         1.8806849718093872
      ]
   },
   "m2StoneCageLantern": {
      "min": [
         -0.5968887805938721,
         -0.9497255682945251,
         -0.6994380950927734
      ],
      "size": [
         1.193001627922058,
         1.8981482982635498,
         1.3979766368865967
      ]
   },
   "m2TempleBeam": {
      "min": [
         -0.952897310256958,
         -0.26726436614990234,
         -0.2013237327337265
      ],
      "size": [
         1.9020307064056396,
         0.5330254435539246,
         0.40481722354888916
      ]
   },
   "m2TempleLedge": {
      "min": [
         -0.9497146010398865,
         -0.2020813226699829,
         -0.9012075066566467
      ],
      "size": [
         1.8995530605316162,
         0.40249282121658325,
         1.7983520030975342
      ]
   },
   "m2TempleTowerBg": {
      "min": [
         -0.6717894077301025,
         -0.9056226015090942,
         -0.9441483616828918
      ],
      "size": [
         1.3454740047454834,
         1.8113627433776855,
         1.8928931951522827
      ]
   },
   "m2WoodenBalconyV2": {
      "min": [
         -0.9004978537559509,
         -0.7477969527244568,
         -0.9474291801452637
      ],
      "size": [
         1.8058202266693115,
         1.4959180355072021,
         1.8997865915298462
      ]
   }
};
