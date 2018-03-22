import { fjsx as fjsxObj } from "fjsx";

declare global {
  var fjsx: typeof fjsxObj;
}

global["fjsx"] = fjsxObj;

// NOTE: If you don't want to use fjsx instance globally
// you must put < import {fjsx} from "fjsx" > code in every view.
