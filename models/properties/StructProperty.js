import { Property } from "./Property.js";
import { PropertyFactory } from "../factories/PropertyFactory.js";
import { Serializer } from "../../utils/Serializer.js";

export class StructProperty extends Property {
  constructor() {
    super();
    this.Type = "StructProperty";
    this.StoredPropertyType = "";
    this.StructGuid = "00000000000000000000000000000000";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Properties = [];
    this.RawData = "";
  }

  get HeaderSize() {
    let nameStr = this.Name.endsWith("\0") ? this.Name : this.Name + "\0";
    let typeStr = this.Type.endsWith("\0") ? this.Type : this.Type + "\0";
    let structStr = this.StoredPropertyType.endsWith("\0")
      ? this.StoredPropertyType
      : this.StoredPropertyType + "\0";

    let size = Buffer.byteLength(nameStr, "utf8") + 4;
    size += Buffer.byteLength(typeStr, "utf8") + 4;
    size += 8; // 4 byte size + 4 byte array index
    size += Buffer.byteLength(structStr, "utf8") + 4;
    size += 16; // 16 byte struct guid
    size += 1; // 1 byte hasPropertyGuid
    if (this.HasPropertyGuid === 1) size += 16;
    return size;
  }

  get ValueSize() {
    if (this.RawData) {
      return Buffer.from(this.RawData, "base64").length;
    }
    let size = 0;
    for (let i = 0; i < this.Properties.length; i++) {
      size += this.Properties[i].Size;
    }
    size += 9; // 'None\0'
    return size;
  }

  get Size() {
    return this.HeaderSize + this.ValueSize;
  }

  get Count() {
    return this.Properties.length;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.StoredPropertyType = serial.readString();
    this.StructGuid = serial.readBytes(16).toString("hex");
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }

    let startOffset = serial.tell;
    let endOffset = startOffset + size;
    let cleanType = this.StoredPropertyType.replace(/\0$/, "");
    let rawStructs = new Set([
      "Vector",
      "Rotator",
      "Quat",
      "LinearColor",
      "DateTime",
      "Guid",
      "IntPoint",
      "IntVector",
      "Transform",
      "SoftObjectPath",
    ]);

    if (size === 0) {
      this.Properties = [];
      this.RawData = "";
    } else if (rawStructs.has(cleanType) || size < 9) {
      this.RawData = serial.read(size).toString("base64");
      this.Properties = [];
    } else {
      let tail = serial.Data.subarray(endOffset - 9, endOffset).toString(
        "latin1",
      );
      if (!tail.includes("None\0")) {
        this.RawData = serial.read(size).toString("base64");
        this.Properties = [];
      } else {
        this.Properties = [];
        try {
          while (serial.tell < endOffset) {
            let pName = serial.readString();
            if (pName === "None\0" || pName === "None") {
              break;
            }
            let pType = serial.readString();
            let pSize = serial.readInt32();
            let prop = PropertyFactory.create({ Name: pName, Type: pType });
            prop.deserialize(serial, pSize);
            this.Properties.push(prop);
          }
          serial.tell = endOffset;
        } catch (err) {
          serial.tell = startOffset;
          this.RawData = serial.read(size).toString("base64");
          this.Properties = [];
        }
      }
    }
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.Size);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(this.ValueSize);
    serial.writeInt32(this.ArrayIndex);
    serial.writeString(this.StoredPropertyType);
    serial.writeBytes(
      Buffer.from(this.StructGuid || "00000000000000000000000000000000", "hex"),
    );
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }

    if (this.RawData) {
      serial.writeBytes(Buffer.from(this.RawData, "base64"));
    } else {
      for (let i = 0; i < this.Properties.length; i++) {
        serial.write(this.Properties[i].serialize());
      }
      serial.writeString("None\0");
    }
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let struct = new StructProperty();
    struct.Name = obj.Name;
    struct.Type = obj.Type;
    struct.StoredPropertyType = obj.StoredPropertyType;
    struct.StructGuid = obj.StructGuid || "00000000000000000000000000000000";
    struct.ArrayIndex = obj.ArrayIndex || 0;
    struct.HasPropertyGuid = obj.HasPropertyGuid || 0;
    struct.PropertyGuid = obj.PropertyGuid || null;
    struct.RawData = obj.RawData || "";
    struct.Properties = [];
    if (obj.Properties !== undefined && Array.isArray(obj.Properties)) {
      obj.Properties.forEach((prop) =>
        struct.Properties.push(PropertyFactory.create(prop)),
      );
    }
    return struct;
  }
}
