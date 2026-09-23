import { PropertyFactory } from "../models/factories/index.js";

export class CoralPlayerEditor {
  /**
   * Find player structs (pendingChangedPlayerInfo and playerInfo) inside Gvas or JSON object
   */
  static findTargetStructs(root) {
    let pendingChangedPlayerInfo = null;
    let playerInfo = null;

    function traverse(node) {
      if (!node || typeof node !== "object") return;

      let structType = (node.StoredPropertyType || "")
        .replace(/\0/g, "")
        .trim();
      let name = (node.Name || "").replace(/\0/g, "").trim();

      if (
        structType === "C_ChangedPlayerInfo" ||
        name === "pendingChangedPlayerInfo"
      ) {
        pendingChangedPlayerInfo = node;
      }
      if (structType === "C_PlayerInformation" || name === "playerInfo") {
        playerInfo = node;
      }

      if (Array.isArray(node)) {
        for (let item of node) {
          traverse(item);
        }
      } else {
        for (let key of Object.keys(node)) {
          traverse(node[key]);
        }
      }
    }

    traverse(root);
    return { pendingChangedPlayerInfo, playerInfo };
  }

  /**
   * Get a string property from a struct
   */
  static getPropValue(structNode, propName) {
    if (!structNode || !structNode.Properties) return "";
    let prop = structNode.Properties.find(
      (p) =>
        p.Name &&
        p.Name.replace(/\0/g, "").trim().toLowerCase() ===
          propName.toLowerCase(),
    );
    if (!prop) return "";
    let val =
      prop.Property !== undefined
        ? prop.Property
        : prop.Value !== undefined
          ? prop.Value
          : "";
    if (typeof val === "string") {
      return val.replace(/\0/g, "").trim();
    }
    return String(val);
  }

  /**
   * Set a string property value on a struct
   */
  static setPropValue(structNode, propName, newValue) {
    if (!structNode || !structNode.Properties) return false;
    let prop = structNode.Properties.find(
      (p) =>
        p.Name &&
        p.Name.replace(/\0/g, "").trim().toLowerCase() ===
          propName.toLowerCase(),
    );
    if (!prop) return false;

    let toSet = newValue;
    if (
      typeof toSet === "string" &&
      toSet.length > 0 &&
      !toSet.endsWith("\0")
    ) {
      toSet = toSet + "\0";
    }
    prop.Property = toSet;
    if (prop.Value !== undefined) {
      prop.Value = toSet;
    }
    return true;
  }

  /**
   * Normalize gender enum string
   */
  static normalizeGender(gender) {
    if (!gender) return "";
    let clean = gender.replace(/\0/g, "").trim();
    let lower = clean.toLowerCase();
    if (lower === "male" || lower === "m") return "EC_Gender::Male\0";
    if (lower === "female" || lower === "f") return "EC_Gender::Female\0";
    if (lower === "other" || lower === "mx") return "EC_Gender::Other\0";
    if (lower === "custom") return "EC_Gender::Custom\0";
    if (lower === "none") return "EC_Gender::None\0";
    if (!clean.endsWith("\0")) return clean + "\0";
    return clean;
  }

  /**
   * Get current player information
   */
  static getPlayerInfo(root) {
    let { pendingChangedPlayerInfo, playerInfo } = this.findTargetStructs(root);

    let name =
      this.getPropValue(playerInfo, "Name") ||
      this.getPropValue(pendingChangedPlayerInfo, "playerName") ||
      "";
    let gender =
      this.getPropValue(playerInfo, "gender") ||
      this.getPropValue(pendingChangedPlayerInfo, "gender") ||
      "";
    let title =
      this.getPropValue(playerInfo, "CustomGenderText") ||
      this.getPropValue(pendingChangedPlayerInfo, "CustomGenderText") ||
      "";
    let parentLabel =
      this.getPropValue(playerInfo, "parentLabel") ||
      this.getPropValue(pendingChangedPlayerInfo, "parentLabel") ||
      "";
    let farmName =
      this.getPropValue(playerInfo, "farmName") ||
      this.getPropValue(pendingChangedPlayerInfo, "farmName") ||
      "";

    return {
      name,
      gender,
      title,
      parentLabel,
      farmName,
    };
  }

  /**
   * Modify player info
   */
  static editPlayer(root, options = {}) {
    let { pendingChangedPlayerInfo, playerInfo } = this.findTargetStructs(root);

    if (!playerInfo && !pendingChangedPlayerInfo) {
      throw new Error(
        "Could not find player information structs (C_PlayerInformation or C_ChangedPlayerInfo) in save data.",
      );
    }

    let before = this.getPlayerInfo(root);

    let newName = options.name !== undefined ? options.name : before.name;
    let newTitle = options.title !== undefined ? options.title : before.title;
    let newFarm =
      options.farmName !== undefined ? options.farmName : before.farmName;

    // Handle gender logic:
    // In Coral Island (UE 4.27 UC_TextUtilConfig::GetGenderTitle):
    // - EC_Gender::Female hardcodes 'Ms.' -> localized in Indonesian as 'Nona'
    // - EC_Gender::Male hardcodes 'Mr.' -> localized in Indonesian as 'Tuan'
    // - EC_Gender::Other hardcodes 'Mx.'
    // - EC_Gender::Custom uses CustomGenderText
    // If setting a custom title (like 'Kak'), gender MUST be EC_Gender::Custom
    // so that dialogue system reads CustomGenderText instead of hardcoding 'Nona'/'Tuan'.
    let newGender = before.gender;
    if (options.gender !== undefined) {
      newGender = this.normalizeGender(options.gender);
    } else if (options.title !== undefined && options.title !== "") {
      newGender = "EC_Gender::Custom\0";
    }

    // Update playerInfo (C_PlayerInformation)
    if (playerInfo) {
      if (options.name !== undefined) {
        this.setPropValue(playerInfo, "Name", newName);
        this.setPropValue(playerInfo, "SanitizedName", newName);
      }
      if (options.title !== undefined) {
        this.setPropValue(playerInfo, "CustomGenderText", newTitle);
        this.setPropValue(playerInfo, "sanitizedCustomGender", newTitle);
        this.setPropValue(playerInfo, "parentLabel", newTitle);
        this.setPropValue(playerInfo, "sanitizedParentLabel", newTitle);
      }
      if (newGender) {
        this.setPropValue(playerInfo, "gender", newGender);
      }
      if (options.farmName !== undefined) {
        this.setPropValue(playerInfo, "farmName", newFarm);
        this.setPropValue(playerInfo, "sanitizedFarmName", newFarm);
      }
    }

    // Update pendingChangedPlayerInfo (C_ChangedPlayerInfo)
    if (pendingChangedPlayerInfo) {
      if (options.name !== undefined) {
        this.setPropValue(pendingChangedPlayerInfo, "playerName", newName);
        this.setPropValue(
          pendingChangedPlayerInfo,
          "sanitizedPlayerName",
          newName,
        );
      }
      if (options.title !== undefined) {
        this.setPropValue(
          pendingChangedPlayerInfo,
          "CustomGenderText",
          newTitle,
        );
        this.setPropValue(
          pendingChangedPlayerInfo,
          "sanitizedCustomGenderText",
          newTitle,
        );
        this.setPropValue(pendingChangedPlayerInfo, "parentLabel", newTitle);
        this.setPropValue(
          pendingChangedPlayerInfo,
          "sanitizedParentLabel",
          newTitle,
        );
      }
      if (newGender) {
        this.setPropValue(pendingChangedPlayerInfo, "gender", newGender);
      }
      if (options.farmName !== undefined) {
        this.setPropValue(pendingChangedPlayerInfo, "farmName", newFarm);
        this.setPropValue(
          pendingChangedPlayerInfo,
          "sanitizedFarmName",
          newFarm,
        );
      }
    }

    let after = this.getPlayerInfo(root);

    return {
      before,
      after,
    };
  }

  /**
   * Find player save data (C_PlayerSaveData) containing inventory and storage
   */
  static findPlayerSaveData(root) {
    let target = null;
    function traverse(node) {
      if (!node || typeof node !== "object" || target) return;
      let structType = (node.StoredPropertyType || "")
        .replace(/\0/g, "")
        .trim();
      let name = (node.Name || "").replace(/\0/g, "").trim();

      if (structType === "C_PlayerSaveData") {
        target = node;
        return;
      }
      if (name === "players" && node.Elements && node.Elements.length > 0) {
        target = node.Elements[0];
        return;
      }

      if (Array.isArray(node)) {
        for (let item of node) traverse(item);
      } else {
        for (let key of Object.keys(node)) traverse(node[key]);
      }
    }
    traverse(root);
    return target;
  }

  /**
   * Get all inventory items from save data
   */
  static getInventory(root) {
    let playerData = this.findPlayerSaveData(root);
    if (!playerData || !playerData.Properties) return [];
    let invProp = playerData.Properties.find(
      (p) =>
        (p.Name || "").replace(/\0/g, "").trim().toLowerCase() === "inventory",
    );
    if (!invProp || !invProp.Elements) return [];

    return invProp.Elements.map((el, index) => {
      let slotIndex = -1;
      let id = "";
      let quantity = 1;
      let charges = -1;
      let maxCharges = -1;

      if (el.Properties) {
        for (let p of el.Properties) {
          let pName = (p.Name || "").replace(/\0/g, "").trim();
          let val = p.Property !== undefined ? p.Property : p.Value;
          if (pName === "desiredSlotIndex") {
            slotIndex = Array.isArray(val) ? val[1] : Number(val);
          } else if (pName === "ID") {
            id = (typeof val === "string" ? val : "").replace(/\0/g, "").trim();
          } else if (pName === "quantity") {
            quantity = Array.isArray(val) ? val[1] : Number(val);
          } else if (pName === "charges") {
            charges = Array.isArray(val) ? val[1] : Number(val);
          } else if (pName === "maxCharges") {
            maxCharges = Array.isArray(val) ? val[1] : Number(val);
          }
        }
      }

      return {
        index,
        slotIndex,
        id,
        quantity,
        charges,
        maxCharges,
        _element: el,
      };
    });
  }

  /**
   * Update item quantities in inventory
   * @param {object} root - Gvas or JSON root object
   * @param {Array<{ id?: string, slot?: number, quantity: number }>} updates
   * @returns {Array<{ id: string, slot: number, before: number, after: number }>}
   */
  static setItemQuantities(root, updates = []) {
    let inventory = this.getInventory(root);
    let results = [];

    for (let u of updates) {
      let match = inventory.find((item) => {
        if (u.slot !== undefined && item.slotIndex === Number(u.slot))
          return true;
        if (u.id && item.id.toLowerCase() === u.id.toLowerCase()) return true;
        return false;
      });

      if (match && match._element && match._element.Properties) {
        let qtyProp = match._element.Properties.find(
          (p) => (p.Name || "").replace(/\0/g, "").trim() === "quantity",
        );
        if (qtyProp) {
          let before = match.quantity;
          let toSet = Number(u.quantity);
          qtyProp.Value = toSet;
          if (qtyProp.Property !== undefined) {
            qtyProp.Property = [0, toSet];
          }
          results.push({
            id: match.id,
            slot: match.slotIndex,
            before,
            after: toSet,
          });
        }
      }
    }

    return results;
  }

  /**
   * Add or replace an inventory item slot
   * @param {object} root - Gvas or JSON root object
   * @param {number} slotIndex - Desired slot index (0 to 39)
   * @param {string} itemId - Item ID (e.g. item_65063)
   * @param {number} quantity - Quantity
   */
  static setInventorySlot(root, slotIndex, itemId, quantity = 999) {
    let playerData = this.findPlayerSaveData(root);
    if (!playerData || !playerData.Properties) return false;
    let invProp = playerData.Properties.find(
      (p) =>
        (p.Name || "").replace(/\0/g, "").trim().toLowerCase() === "inventory",
    );
    if (!invProp || !invProp.Elements) return false;

    // Check if slot already exists
    let existing = invProp.Elements.find((el) => {
      let sProp = el.Properties?.find(
        (p) => (p.Name || "").replace(/\0/g, "").trim() === "desiredSlotIndex",
      );
      let sVal = sProp
        ? Array.isArray(sProp.Value)
          ? sProp.Value[1]
          : sProp.Value
        : -1;
      return Number(sVal) === Number(slotIndex);
    });

    if (existing) {
      let idProp = existing.Properties.find(
        (p) => (p.Name || "").replace(/\0/g, "").trim() === "ID",
      );
      let qProp = existing.Properties.find(
        (p) => (p.Name || "").replace(/\0/g, "").trim() === "quantity",
      );
      if (idProp)
        idProp.Property = itemId.endsWith("\0") ? itemId : itemId + "\0";
      if (qProp) qProp.Value = Number(quantity);
      return true;
    }

    // Find a template element to clone
    let template = invProp.Elements[0];
    let clone = JSON.parse(JSON.stringify(template));
    for (let p of clone.Properties) {
      let pName = (p.Name || "").replace(/\0/g, "").trim();
      if (pName === "desiredSlotIndex") p.Value = Number(slotIndex);
      else if (pName === "ID")
        p.Property = itemId.endsWith("\0") ? itemId : itemId + "\0";
      else if (pName === "quantity") p.Value = Number(quantity);
      else if (pName === "objectData") {
        p.Count = 0;
        p.Elements = [];
        p.RawData = "";
      }
    }

    let finalElement =
      typeof template.serialize === "function"
        ? PropertyFactory.create(clone)
        : clone;
    invProp.Elements.push(finalElement);
    invProp.Elements.sort((a, b) => {
      let sa =
        a.Properties?.find(
          (p) =>
            (p.Name || "").replace(/\0/g, "").trim() === "desiredSlotIndex",
        )?.Value || 0;
      let sb =
        b.Properties?.find(
          (p) =>
            (p.Name || "").replace(/\0/g, "").trim() === "desiredSlotIndex",
        )?.Value || 0;
      return Number(sa) - Number(sb);
    });

    return true;
  }
}
