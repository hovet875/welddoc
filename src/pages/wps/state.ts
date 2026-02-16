import type { WPQRRow, WPSRow } from "../../repo/wpsRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { StandardRow } from "../../repo/standardRepo";
import type { WeldingProcessRow } from "../../repo/weldingProcessRepo";
import type { WeldJointTypeRow } from "../../repo/weldJointTypeRepo";

export type WpsPageState = {
  wpqrAll: WPQRRow[];
  wpsAll: WPSRow[];
  materials: MaterialRow[];
  standards: StandardRow[];
  processes: WeldingProcessRow[];
  jointTypes: WeldJointTypeRow[];
  loadSeq: number;
  loading: boolean;
  isAdmin: boolean;
};

export function createState(): WpsPageState {
  return {
    wpqrAll: [],
    wpsAll: [],
    materials: [],
    standards: [],
    processes: [],
    jointTypes: [],
    loadSeq: 0,
    loading: false,
    isAdmin: false,
  };
}

