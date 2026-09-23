import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";
import { SerializationError } from "../PropertyErrors.js";

export class ByteProperty extends Property {
  constructor() {
    super();
    this.Type = "ByteProperty";
    this.EnumName = "None\0";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Property = 0; // uint8 number or string enum value
  }

  get ValueSize() {
    if (this.EnumName === "None\0" || this.EnumName === "None") {
      return 1;
    } else {
      let str = typeof this.Property === "string" ? this.Property : "";
      if (!str.endsWith("\0")) str += "\0";
      return Buffer.byteLength(str, "utf8") + 4;
    }
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4; // Name, Type, Size, ArrayIndex
    let enumStr = this.EnumName.endsWith("\0")
      ? this.EnumName
      : this.EnumName + "\0";
    size += Buffer.byteLength(enumStr, "utf8") + 4; // EnumName
    size += 1; // HasPropertyGuid
    if (this.HasPropertyGuid === 1) size += 16;
    size += this.ValueSize;
    return size;
  }

  get Size() {
    return this.TotalSize;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.EnumName = serial.readString();
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }

    if (this.EnumName === "None\0" || this.EnumName === "None") {
      this.Property = serial.readUInt8();
    } else {
      this.Property = serial.readString();
    }
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(this.ValueSize);
    serial.writeInt32(this.ArrayIndex);
    serial.writeString(this.EnumName);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }

    if (this.EnumName === "None\0" || this.EnumName === "None") {
      serial.writeUInt8(Number(this.Property));
    } else {
      serial.writeString(this.Property);
    }
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new ByteProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.EnumName = obj.EnumName || "None\0";
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.Property = obj.Property !== undefined ? obj.Property : 0;
    return prop;
  }
}
