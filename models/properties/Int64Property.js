import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class Int64Property extends Property {
  constructor() {
    super();
    this.Type = "Int64Property";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Value = "0";
  }

  get ValueSize() {
    return 8;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4 + 1 + 8;
    if (this.HasPropertyGuid === 1) size += 16;
    return size;
  }

  get Size() {
    return this.TotalSize;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }
    let bi = serial.readInt64();
    this.Value = bi.toString();
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(8);
    serial.writeInt32(this.ArrayIndex);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }
    serial.writeInt64(BigInt(this.Value || 0));
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new Int64Property();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.Value =
      obj.Value !== undefined
        ? String(obj.Value)
        : obj.Property !== undefined
          ? String(obj.Property)
          : "0";
    return prop;
  }
}
