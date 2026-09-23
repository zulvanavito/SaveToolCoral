import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class SoftObjectProperty extends Property {
  constructor() {
    super();
    this.Type = "SoftObjectProperty";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Property = "";
    this.SubPath = "";
  }

  get ValueSize() {
    let str = typeof this.Property === "string" ? this.Property : "";
    if (!str.endsWith("\0")) str += "\0";
    let size = Buffer.byteLength(str, "utf8") + 4;
    let sub = typeof this.SubPath === "string" ? this.SubPath : "";
    if (sub.length > 0) {
      if (!sub.endsWith("\0")) sub += "\0";
      size += Buffer.byteLength(sub, "utf8") + 4;
    } else {
      size += 4; // empty subpath length
    }
    return size;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4 + 1;
    if (this.HasPropertyGuid === 1) size += 16;
    size += this.ValueSize;
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
    this.Property = serial.readString();
    // In UE4, SoftObjectPath has AssetPathName (FName) + SubPathString (FString)
    let remaining = size - (Buffer.byteLength(this.Property, "utf8") + 4);
    if (remaining >= 4) {
      this.SubPath = serial.readString();
    } else if (remaining > 0) {
      serial.read(remaining);
    }
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(this.ValueSize);
    serial.writeInt32(this.ArrayIndex);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }
    serial.writeString(this.Property);
    serial.writeString(this.SubPath || "");
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new SoftObjectProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.Property = obj.Property !== undefined ? obj.Property : "";
    prop.SubPath = obj.SubPath !== undefined ? obj.SubPath : "";
    return prop;
  }
}
