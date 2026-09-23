import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class IntProperty extends Property {
  constructor() {
    super();
    this.Type = "IntProperty";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Value = 0;
  }

  get Property() {
    return [this.ArrayIndex, this.Value];
  }

  set Property(val) {
    if (Array.isArray(val)) {
      this.ArrayIndex = val[0] || 0;
      this.Value = val[1] !== undefined ? val[1] : 0;
    } else if (typeof val === "number") {
      this.Value = val;
    }
  }

  get ValueSize() {
    return 4;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4 + 1 + 4;
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
    this.Value = serial.readInt32();
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(4);
    serial.writeInt32(this.ArrayIndex);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }
    serial.writeInt32(this.Value);
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new IntProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    if (obj.Property !== undefined) {
      prop.Property = obj.Property;
    } else if (obj.Value !== undefined) {
      prop.Value = obj.Value;
    }
    return prop;
  }
}
