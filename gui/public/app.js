import {
  createApp,
  ref,
  computed,
  onMounted,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

createApp({
  setup() {
    const fileLoaded = ref(false);
    const fileName = ref("");
    const fileSize = ref(0);
    const isDragging = ref(false);
    const uploading = ref(false);
    const saving = ref(false);
    const hasWorkspaceFile = ref(false);
    const gameSavePath = ref("");
    const pathCopied = ref(false);
    const fileInputRef = ref(null);

    const activeTab = ref("inventory");
    const player = ref({
      name: "",
      gender: "EC_Gender::Male",
      title: "",
      farmName: "",
      gold: 0,
      meritPoints: 0,
    });
    const inventory = ref([]);

    const toast = ref({
      show: false,
      message: "",
      type: "success",
    });

    const modal = ref({
      open: false,
      slotIndex: 0,
      searchQuery: "",
      searchResults: [],
      selectedItem: null,
      selectedQuality: "base",
      quantity: 1,
      isSearching: false,
    });

    let searchTimeout = null;

    function showToast(message, type = "success") {
      toast.value = { show: true, message, type };
      setTimeout(() => {
        toast.value.show = false;
      }, 4000);
    }

    const iconMap = ref({});
    const iconStats = ref({ count: 0, totalKB: "0", totalMB: "0" });
    const pendingIconFetches = new Set();

    async function fetchIconStats() {
      try {
        const res = await fetch("/api/icons/stats");
        const data = await res.json();
        if (data.success) {
          iconStats.value = data;
        }
      } catch (err) {
        console.error("Error fetching icon stats:", err);
      }
    }

    async function clearIconCache() {
      try {
        const res = await fetch("/api/icons/clear", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          iconMap.value = {};
          await fetchIconStats();
          showToast("Cache ikon lokal berhasil dibersihkan.");
          resolveBagIcons();
        }
      } catch (err) {
        showToast("Gagal membersihkan cache ikon: " + err.message, "error");
      }
    }

    async function resolveIcons(names = []) {
      const needed = names.filter(
        (n) =>
          n &&
          n !== "(Kosong)" &&
          !iconMap.value[n] &&
          !pendingIconFetches.has(n),
      );
      if (needed.length === 0) return;

      needed.forEach((n) => pendingIconFetches.add(n));
      try {
        const res = await fetch("/api/icons/resolve-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: needed }),
        });
        const data = await res.json();
        if (data.success && data.icons) {
          for (const [name, url] of Object.entries(data.icons)) {
            if (url) {
              iconMap.value[name] = url;
            }
          }
        }
      } catch (err) {
        console.error("Error resolving icons:", err);
      } finally {
        needed.forEach((n) => pendingIconFetches.delete(n));
      }
    }

    function resolveBagIcons() {
      if (!inventory.value || !Array.isArray(inventory.value)) return;
      const names = inventory.value
        .filter((s) => !s.empty && s.name && s.name !== "(Kosong)")
        .map((s) => s.name);
      resolveIcons(names);
    }

    function onImageLoad(event, name) {
      // Image loaded cleanly via browser HTTP cache
    }

    function onImageError(name) {
      iconMap.value[name] = null;
    }

    // Check game save path and icon stats on mount
    onMounted(async () => {
      try {
        const res = await fetch("/api/save-path");
        const data = await res.json();
        if (data.success) {
          gameSavePath.value = data.path;
        }

        // Check if workspace file is available as a shortcut
        const wsRes = await fetch("/api/load-workspace");
        if (wsRes.ok) {
          hasWorkspaceFile.value = true;
        }

        await fetchIconStats();
      } catch (err) {
        console.error("Init error:", err);
      }
    });

    function triggerFileInput() {
      if (fileInputRef.value) {
        fileInputRef.value.click();
      }
    }

    function onFileSelected(e) {
      const file = e.target.files && e.target.files[0];
      if (file) {
        processUploadedFile(file);
      }
      e.target.value = ""; // Reset file input
    }

    function onDragOver(e) {
      e.preventDefault();
      isDragging.value = true;
    }

    function onDragLeave(e) {
      e.preventDefault();
      isDragging.value = false;
    }

    function onFileDrop(e) {
      e.preventDefault();
      isDragging.value = false;
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        processUploadedFile(file);
      }
    }

    async function processUploadedFile(file) {
      if (!file.name.toLowerCase().endsWith(".sav")) {
        showToast(
          "Harap pilih file dengan ekstensi .sav (Unreal Engine Save)",
          "error",
        );
        return;
      }

      uploading.value = true;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Filename": encodeURIComponent(file.name),
          },
          body: file,
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        fileName.value = data.filename;
        fileSize.value = data.size;
        player.value = data.player;
        inventory.value = data.inventory;
        fileLoaded.value = true;
        showToast(`File ${data.filename} berhasil dimuat!`);
        resolveBagIcons();
      } catch (err) {
        showToast("Gagal memproses file: " + err.message, "error");
      } finally {
        uploading.value = false;
      }
    }

    // Load workspace save file
    async function loadWorkspaceSave() {
      uploading.value = true;
      try {
        const res = await fetch("/api/load-workspace");
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        fileName.value = data.filename;
        fileSize.value = data.size;
        player.value = data.player;
        inventory.value = data.inventory;
        fileLoaded.value = true;
        showToast("ManualSave0.sav dari workspace berhasil dimuat!");
        resolveBagIcons();
      } catch (err) {
        showToast("Gagal memuat save workspace: " + err.message, "error");
      } finally {
        uploading.value = false;
      }
    }

    function resetCurrentFile() {
      fileLoaded.value = false;
      fileName.value = "";
      fileSize.value = 0;
      inventory.value = [];
    }

    async function downloadSave() {
      if (!fileLoaded.value) return;
      saving.value = true;
      try {
        // Sync changes to server
        const saveRes = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player: player.value,
            inventory: inventory.value,
          }),
        });

        const saveData = await saveRes.json();
        if (!saveData.success) throw new Error(saveData.error);

        // Trigger browser download
        const a = document.createElement("a");
        a.href = "/api/download";
        a.download = fileName.value || "ManualSave0.sav";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast("File save tervalidasi dan berhasil diunduh!");
      } catch (err) {
        showToast("Gagal mengunduh save: " + err.message, "error");
      } finally {
        saving.value = false;
      }
    }

    // Copy game save path to clipboard
    function copyGamePath() {
      if (gameSavePath.value) {
        navigator.clipboard.writeText(gameSavePath.value);
        pathCopied.value = true;
        setTimeout(() => {
          pathCopied.value = false;
        }, 3000);
      }
    }

    const rowHotbar = computed(() => inventory.value.slice(0, 10));
    const rowBag1 = computed(() => inventory.value.slice(10, 20));
    const rowBag2 = computed(() => inventory.value.slice(20, 30));
    const rowBag3 = computed(() => inventory.value.slice(30, 40));

    function isTool(id) {
      if (!id) return false;
      const lower = id.toLowerCase();
      return (
        lower.includes("tool") ||
        lower.includes("pickaxe") ||
        lower.includes("axe") ||
        lower.includes("hoe") ||
        lower.includes("watering") ||
        lower.includes("scythe") ||
        lower.includes("pole") ||
        lower.includes("rod") ||
        lower.includes("net") ||
        lower.includes("sword")
      );
    }

    function openSlotEditor(slot) {
      modal.value.slotIndex = slot.slotIndex;
      modal.value.quantity = slot.empty ? 1 : slot.quantity || 1;
      modal.value.selectedQuality = slot.quality || "base";
      modal.value.open = true;

      if (!slot.empty) {
        modal.value.searchQuery = slot.name;
        modal.value.selectedItem = {
          baseId: slot.id.replace(/-[a-d]$/, ""),
          name: slot.name,
          category: slot.category,
          hasQualities: slot.hasQualities,
          qualities: slot.availableQualities,
        };
      } else {
        modal.value.searchQuery = "";
        modal.value.selectedItem = null;
      }

      searchItems(modal.value.searchQuery || "osmium");
    }

    function closeSlotEditor() {
      modal.value.open = false;
    }

    // Search items in database
    async function searchItems(q = "") {
      modal.value.isSearching = true;
      try {
        const res = await fetch(
          `/api/items?q=${encodeURIComponent(q)}&limit=40`,
        );
        const data = await res.json();
        if (data.success) {
          modal.value.searchResults = data.items;
          resolveIcons(data.items.map((it) => it.name));
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        modal.value.isSearching = false;
      }
    }

    function onSearchInput() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchItems(modal.value.searchQuery);
      }, 250);
    }

    function selectItem(item) {
      modal.value.selectedItem = item;
      if (item.qualities?.osmium && modal.value.selectedQuality === "osmium") {
        modal.value.selectedQuality = "osmium";
      } else if (!item.qualities?.[modal.value.selectedQuality]) {
        modal.value.selectedQuality = "base";
      }
    }

    const currentComputedId = computed(() => {
      const it = modal.value.selectedItem;
      if (!it) return "";
      const q = modal.value.selectedQuality;
      if (it.qualities && it.qualities[q]) {
        return it.qualities[q];
      }
      return it.baseId;
    });

    function applySlotChanges() {
      if (!modal.value.selectedItem) return;
      const idx = modal.value.slotIndex;
      const targetSlot = inventory.value[idx];
      const appliedId = currentComputedId.value;

      targetSlot.id = appliedId;
      targetSlot.name = modal.value.selectedItem.name;
      targetSlot.category = modal.value.selectedItem.category;
      targetSlot.quantity = Math.max(
        1,
        Math.min(999, Number(modal.value.quantity) || 1),
      );
      targetSlot.quality =
        modal.value.selectedItem.qualities &&
        modal.value.selectedItem.qualities[modal.value.selectedQuality]
          ? modal.value.selectedQuality
          : "base";
      targetSlot.hasQualities = modal.value.selectedItem.hasQualities;
      targetSlot.availableQualities = modal.value.selectedItem.qualities;
      targetSlot.empty = false;

      resolveIcons([targetSlot.name]);
      closeSlotEditor();
      showToast(
        `Slot #${idx + 1} diperbarui: ${targetSlot.name} (${targetSlot.quantity})`,
      );
    }

    function clearSlot() {
      const idx = modal.value.slotIndex;
      const targetSlot = inventory.value[idx];
      targetSlot.id = "";
      targetSlot.name = "(Kosong)";
      targetSlot.category = "Empty";
      targetSlot.quantity = 0;
      targetSlot.quality = "base";
      targetSlot.hasQualities = false;
      targetSlot.availableQualities = { base: "" };
      targetSlot.empty = true;

      closeSlotEditor();
      showToast(`Slot #${idx + 1} dikosongkan.`);
    }

    function setQty(val) {
      modal.value.quantity = Math.max(1, Math.min(999, val));
    }

    function addQty(delta) {
      modal.value.quantity = Math.max(
        1,
        Math.min(999, (Number(modal.value.quantity) || 1) + delta),
      );
    }

    function addGold(amount) {
      player.value.gold = Math.max(0, Number(player.value.gold || 0) + amount);
      showToast(`Gold ditambah +${amount.toLocaleString()}`);
    }

    function addMerit(amount) {
      player.value.meritPoints = Math.max(
        0,
        Number(player.value.meritPoints || 0) + amount,
      );
      showToast(`Merit Points ditambah +${amount.toLocaleString()}`);
    }

    return {
      fileLoaded,
      fileName,
      fileSize,
      isDragging,
      uploading,
      saving,
      hasWorkspaceFile,
      gameSavePath,
      pathCopied,
      fileInputRef,
      activeTab,
      player,
      inventory,
      toast,
      modal,
      rowHotbar,
      rowBag1,
      rowBag2,
      rowBag3,
      currentComputedId,
      iconMap,
      iconStats,
      fetchIconStats,
      clearIconCache,
      onImageLoad,
      onImageError,
      triggerFileInput,
      onFileSelected,
      onDragOver,
      onDragLeave,
      onFileDrop,
      loadWorkspaceSave,
      resetCurrentFile,
      downloadSave,
      copyGamePath,
      isTool,
      openSlotEditor,
      closeSlotEditor,
      onSearchInput,
      selectItem,
      applySlotChanges,
      clearSlot,
      setQty,
      addQty,
      addGold,
      addMerit,
    };
  },
}).mount("#app");
