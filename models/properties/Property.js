import { Serializer } from "../../utils/Serializer.js";

export class Property {
  constructor() {
    this.Name = "";
    this.Type = "";
    this._size = 0;
  }
  get Size() {
    if (this.TotalSize !== undefined) return this.TotalSize;
    return this._size || 0;
  }
  set Size(val) {
    this._size = val;
  }
  deserialize(serial, size) {
    throw new Error(
      `Deserialization not implemented for property: ${this.Type}`,
    );
  }
  serialize() {
    throw new Error(`Serialization not implemented for property: ${this.Type}`);
  }
  static from(json) {
    throw new Error(`from() not implemented for property: ${this.Type}`);
  }
}
