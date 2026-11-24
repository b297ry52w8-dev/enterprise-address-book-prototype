(function () {
  "use strict";

  const ICONS = { folder: "i-folder", all: "i-folder" };
  const USER_PERMISSIONS = window.USER_PERMISSIONS || ["contact:export"];

  const organizationTree = [
    { id: "all", name: "全部组织", type: "all", children: [
      { id: "company", name: "集团公司", children: [
        { id: "engineering", name: "工程管理中心", children: [
          { id: "eng-quality", name: "质量安全部" }, { id: "wuhan", name: "武汉项目部" },
          { id: "ezhou", name: "鄂州项目部" }, { id: "huangshi", name: "黄石项目部" },
          { id: "xiangyang", name: "襄阳项目部" }, { id: "yichang", name: "宜昌项目部" }
        ]},
        { id: "administration", name: "综合管理中心", children: [
          { id: "executive", name: "行政管理部" }, { id: "hr", name: "人力资源部" }, { id: "party", name: "党委办公室" }
        ]},
        { id: "marketing", name: "市场经营中心", children: [
          { id: "east-market", name: "华东经营部" }, { id: "tender", name: "投标管理部" }, { id: "customer", name: "客户发展部" }
        ]},
        { id: "finance", name: "财务管理中心", children: [
          { id: "accounting", name: "会计核算部" }, { id: "funds", name: "资金管理部" }, { id: "tax", name: "税务管理部" }
        ]},
        { id: "technology", name: "技术中心", children: [
          { id: "rnd", name: "研发一部" }, { id: "it", name: "信息化管理部" }, { id: "standards", name: "标准与质量部" }
        ]},
        { id: "procurement", name: "采购供应中心", children: [
          { id: "purchase", name: "采购管理部" }, { id: "warehouse", name: "物资保障部" }
        ]},
        { id: "safety", name: "安全管理中心", children: [
          { id: "safety-office", name: "安全监督部" }
        ]}
      ]}
    ]}
  ];

  const positions = ["项目经理", "项目副经理", "工程管理部部长", "项目管理专员", "施工负责人", "总工程师", "质量工程师", "安全工程师", "行政主管", "人力资源专员", "经营经理", "投标专员", "客户经理", "会计", "资金专员", "税务专员", "高级工程师", "系统工程师", "技术负责人", "采购专员", "物资管理员", "安全专员"];
  const fixedNames = ["陈建华", "李雪", "王强", "刘敏", "张磊", "赵宇", "孙悦", "周伟", "吴迪", "郑凯", "高娜", "黄良", "徐洁", "马超", "曹亮", "何静", "彭博", "唐琳", "魏峰", "江宇"];
  const surnames = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜".split("");
  const givenNames = "一二三四五六七八九十子安嘉宁思远明哲晓雨文博俊杰雅静欣怡泽宇浩然".split("");
  const leafOrgIds = collectLeafOrgIds(organizationTree[0]);
  const generatedContacts = createMockContacts(146);

  const state = {
    selectedOrgId: "all",
    pendingOrgId: "",
    expanded: new Set(["all", "company"]),
    pickerExpanded: new Set(["all", "company"]),
    name: "",
    positionKeyword: "",
    selectedPosition: "",
    pageNo: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    currentRows: [],
    selectedContactIds: new Set(),
    loading: false
  };

  const dom = {};
  let toastTimer;

  const ContactApi = {
    async getOrganizationTree() {
      return clone(organizationTree);
    },
    async queryContacts({ orgId, includeChildren = true, name = "", positionId, positionKeyword = "", pageNo = 1, pageSize = 20 }) {
      await delay(85);
      const orgScope = orgId && orgId !== "all" ? new Set(includeChildren ? collectOrgIds(findOrg(orgId)) : [orgId]) : null;
      const keyword = (positionId || positionKeyword || "").trim().toLowerCase();
      const result = generatedContacts
        .filter(item => item.status === "在岗")
        .filter(item => !orgScope || orgScope.has(item.orgId))
        .filter(item => !name.trim() || item.name.includes(name.trim()))
        .filter(item => !keyword || item.positionName.toLowerCase().includes(keyword))
        .sort((a, b) => a.accountCreatedAt.localeCompare(b.accountCreatedAt));
      const start = (pageNo - 1) * pageSize;
      return { list: result.slice(start, start + pageSize), total: result.length, pageNo, pageSize };
    },
    async getPositionDictionary(keyword = "") {
      await delay(35);
      const normalized = keyword.trim().toLowerCase();
      return positions.filter(item => !normalized || item.toLowerCase().includes(normalized));
    },
    async exportContacts(filters) {
      if (filters.selectedIds && filters.selectedIds.length) {
        const selectedIds = new Set(filters.selectedIds);
        const selectedRows = generatedContacts
          .filter(item => item.status === "在岗" && selectedIds.has(item.id))
          .sort((a, b) => a.accountCreatedAt.localeCompare(b.accountCreatedAt));
        return createXlsxBlob(selectedRows);
      }
      const result = await this.queryContacts({ ...filters, pageNo: 1, pageSize: Number.MAX_SAFE_INTEGER });
      return createXlsxBlob(result.list);
    }
  };
  window.ContactApi = ContactApi;

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("organizationTree") && document.getElementById("contactsBody")) init();
  });

  async function init() {
    cacheDom();
    bindEvents();
    applyPermissionVisibility();
    await ContactApi.getOrganizationTree();
    renderOrganizationTree();
    renderDepartmentPicker();
    await renderPositionOptions("");
    await loadContacts();
  }

  function cacheDom() {
    ["affairsTrigger", "affairsDrawer", "organizationTree", "departmentTrigger", "departmentText", "departmentPopover", "departmentPickerTree", "positionInput", "positionPopover", "searchForm", "nameInput", "resetButton", "selectedCount", "exportButton", "exportButtonLabel", "selectPageCheckbox", "contactsBody", "tableLoading", "emptyState", "listHeading", "resultCountHeading", "totalCount", "pageSizeSelect", "prevPage", "nextPage", "pageNumbers", "pageJumpInput", "exportModal", "exportDialogDescription", "closeExportModal", "cancelExport", "confirmExport", "toast"].forEach(id => dom[id] = document.getElementById(id));
  }

  function bindEvents() {
    dom.affairsTrigger.addEventListener("click", event => { event.stopPropagation(); toggleAffairsDrawer(); });
    dom.affairsDrawer.addEventListener("click", handleAffairsRoute);
    dom.departmentTrigger.addEventListener("click", event => { event.stopPropagation(); togglePopover("department"); });
    dom.positionInput.addEventListener("focus", () => openPositionPopover());
    dom.positionInput.addEventListener("input", async event => {
      state.selectedPosition = "";
      await renderPositionOptions(event.target.value);
      openPositionPopover();
    });
    dom.searchForm.addEventListener("submit", handleSearch);
    dom.resetButton.addEventListener("click", resetSearch);
    dom.selectPageCheckbox.addEventListener("change", toggleCurrentPageSelection);
    dom.exportButton.addEventListener("click", openExportModal);
    dom.closeExportModal.addEventListener("click", closeExportModal);
    dom.cancelExport.addEventListener("click", closeExportModal);
    dom.confirmExport.addEventListener("click", confirmExport);
    dom.exportModal.addEventListener("click", event => { if (event.target === dom.exportModal) closeExportModal(); });
    dom.pageSizeSelect.addEventListener("change", () => { state.pageSize = Number(dom.pageSizeSelect.value); state.pageNo = 1; loadContacts(); });
    dom.prevPage.addEventListener("click", () => goToPage(state.pageNo - 1));
    dom.nextPage.addEventListener("click", () => goToPage(state.pageNo + 1));
    dom.pageJumpInput.addEventListener("keydown", event => { if (event.key === "Enter") goToPage(Number(event.currentTarget.value)); });
    dom.pageJumpInput.addEventListener("change", event => goToPage(Number(event.currentTarget.value)));
    document.addEventListener("click", closeFloatingLayers);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") { closeFloatingLayers(); closeExportModal(); }
    });
  }

  function applyPermissionVisibility() {
    const canExport = USER_PERMISSIONS.includes("contact:export");
    dom.exportButton.hidden = !canExport;
    document.body.classList.toggle("contact-export-disabled", !canExport);
  }

  function toggleAffairsDrawer(force) {
    const willOpen = force === undefined ? dom.affairsDrawer.hidden : force;
    dom.affairsDrawer.hidden = !willOpen;
    dom.affairsTrigger.setAttribute("aria-expanded", String(willOpen));
  }

  function handleAffairsRoute(event) {
    const button = event.target.closest("button[data-route]");
    if (!button) return;
    const route = button.dataset.route;
    toggleAffairsDrawer(false);
    if (route === "contacts") return;
    if (typeof window.PORTAL_NAVIGATE === "function") window.PORTAL_NAVIGATE(route);
    else {
      window.location.hash = route;
      showToast("演示环境：该入口将沿用现有模块跳转");
    }
  }

  function closeFloatingLayers(event) {
    if (!event || !event.target.closest(".personal-affairs")) toggleAffairsDrawer(false);
    if (!event || !event.target.closest(".department-field")) closeDepartmentPopover();
    if (!event || !event.target.closest(".position-field")) closePositionPopover();
  }

  function togglePopover(type) {
    if (type === "department") {
      const open = dom.departmentPopover.hidden;
      dom.departmentPopover.hidden = !open;
      dom.departmentTrigger.setAttribute("aria-expanded", String(open));
      if (open) closePositionPopover();
    }
  }

  function closeDepartmentPopover() { dom.departmentPopover.hidden = true; dom.departmentTrigger.setAttribute("aria-expanded", "false"); }
  function openPositionPopover() { dom.positionPopover.hidden = false; dom.positionInput.setAttribute("aria-expanded", "true"); closeDepartmentPopover(); }
  function closePositionPopover() { dom.positionPopover.hidden = true; dom.positionInput.setAttribute("aria-expanded", "false"); }

  function renderOrganizationTree() {
    dom.organizationTree.innerHTML = "";
    renderTreeNodes(organizationTree, dom.organizationTree, state.expanded, state.selectedOrgId, {
      onToggle: id => { toggleSet(state.expanded, id); renderOrganizationTree(); },
      onSelect: id => selectOrganization(id, true)
    });
  }

  function renderDepartmentPicker() {
    dom.departmentPickerTree.innerHTML = "";
    renderTreeNodes(organizationTree, dom.departmentPickerTree, state.pickerExpanded, state.pendingOrgId, {
      picker: true,
      onToggle: id => { toggleSet(state.pickerExpanded, id); renderDepartmentPicker(); },
      onSelect: id => {
        state.pendingOrgId = id === "all" ? "" : id;
        syncDepartmentControl();
        renderDepartmentPicker();
        closeDepartmentPopover();
      }
    });
  }

  function renderTreeNodes(nodes, container, expandedSet, selectedId, handlers, depth = 0) {
    nodes.forEach(node => {
      const hasChildren = Boolean(node.children && node.children.length);
      const row = document.createElement("div");
      row.className = "tree-node-row" + (node.id === selectedId ? (handlers.picker ? " picked" : " selected") : "");
      row.style.paddingLeft = `${depth * 23 + 4}px`;
      row.dataset.id = node.id;
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-selected", String(node.id === selectedId));
      if (hasChildren) row.setAttribute("aria-expanded", String(expandedSet.has(node.id)));

      const expander = document.createElement("button");
      expander.type = "button";
      expander.className = `tree-expander ${expandedSet.has(node.id) ? "expanded" : ""} ${hasChildren ? "" : "leaf"}`;
      expander.setAttribute("aria-label", hasChildren ? `${expandedSet.has(node.id) ? "收起" : "展开"}${node.name}` : "");
      expander.innerHTML = `<svg><use href="#i-chevron-right"></use></svg>`;
      expander.addEventListener("click", event => { event.stopPropagation(); if (hasChildren) handlers.onToggle(node.id); });

      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", `tree-icon ${node.type === "all" ? "all" : ""}`);
      icon.innerHTML = `<use href="#${ICONS[node.type] || ICONS.folder}"></use>`;
      const label = document.createElement("span");
      label.className = "tree-label";
      label.textContent = node.name;
      label.title = node.name;
      row.append(expander, icon, label);
      row.addEventListener("click", () => handlers.onSelect(node.id));
      container.appendChild(row);
      if (hasChildren && expandedSet.has(node.id)) renderTreeNodes(node.children, container, expandedSet, selectedId, handlers, depth + 1);
    });
  }

  async function selectOrganization(orgId, load = true) {
    if (orgId !== state.selectedOrgId) clearSelection(true);
    state.selectedOrgId = orgId;
    state.pendingOrgId = orgId === "all" ? "" : orgId;
    state.pageNo = 1;
    expandAncestors(orgId, state.expanded);
    expandAncestors(orgId, state.pickerExpanded);
    syncDepartmentControl();
    renderOrganizationTree();
    renderDepartmentPicker();
    if (load) await loadContacts();
  }

  function syncDepartmentControl() {
    const node = state.pendingOrgId ? findOrg(state.pendingOrgId) : null;
    dom.departmentText.textContent = node ? node.name : "请选择部门";
    dom.departmentText.classList.toggle("placeholder", !node);
  }

  async function renderPositionOptions(keyword) {
    const options = await ContactApi.getPositionDictionary(keyword);
    dom.positionPopover.innerHTML = "";
    if (!options.length) {
      dom.positionPopover.innerHTML = `<div class="position-empty">未找到匹配职务</div>`;
      return;
    }
    options.forEach(position => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "position-option";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(position === state.selectedPosition));
      button.textContent = position;
      button.addEventListener("click", () => {
        state.selectedPosition = position;
        dom.positionInput.value = position;
        closePositionPopover();
      });
      dom.positionPopover.appendChild(button);
    });
  }

  async function handleSearch(event) {
    event.preventDefault();
    const nextName = dom.nameInput.value.trim();
    const nextPositionKeyword = (state.selectedPosition || dom.positionInput.value).trim();
    const targetOrg = state.pendingOrgId || "all";
    const filtersChanged = nextName !== state.name || nextPositionKeyword !== state.positionKeyword || targetOrg !== state.selectedOrgId;
    if (filtersChanged) clearSelection(true);
    state.name = nextName;
    state.positionKeyword = nextPositionKeyword;
    state.selectedOrgId = targetOrg;
    state.pageNo = 1;
    expandAncestors(targetOrg, state.expanded);
    renderOrganizationTree();
    await loadContacts();
  }

  async function resetSearch() {
    clearSelection(true);
    dom.nameInput.value = "";
    dom.positionInput.value = "";
    state.name = "";
    state.positionKeyword = "";
    state.selectedPosition = "";
    state.pendingOrgId = "";
    state.selectedOrgId = "all";
    state.pageNo = 1;
    syncDepartmentControl();
    renderOrganizationTree();
    renderDepartmentPicker();
    await renderPositionOptions("");
    await loadContacts();
  }

  async function loadContacts() {
    setTableLoading(true);
    const result = await ContactApi.queryContacts(currentQueryParams());
    state.currentRows = result.list;
    state.total = result.total;
    state.totalPages = Math.max(1, Math.ceil(result.total / state.pageSize));
    if (state.pageNo > state.totalPages) {
      state.pageNo = state.totalPages;
      return loadContacts();
    }
    renderContacts();
    renderPagination();
    setTableLoading(false);
  }

  function currentQueryParams() {
    return {
      orgId: state.selectedOrgId,
      includeChildren: true,
      name: state.name,
      positionId: state.selectedPosition || undefined,
      positionKeyword: state.selectedPosition ? "" : state.positionKeyword,
      pageNo: state.pageNo,
      pageSize: state.pageSize
    };
  }

  function renderContacts() {
    dom.contactsBody.innerHTML = "";
    state.currentRows.forEach(contact => {
      const row = document.createElement("tr");
      row.classList.toggle("is-selected", state.selectedContactIds.has(contact.id));
      const selection = document.createElement("td");
      selection.className = "selection-cell";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "selection-checkbox";
      checkbox.checked = state.selectedContactIds.has(contact.id);
      checkbox.setAttribute("aria-label", `选择${contact.name}`);
      checkbox.addEventListener("change", () => toggleContactSelection(contact.id, checkbox.checked));
      selection.appendChild(checkbox);
      const name = createCell("name-cell", contact.name);
      const department = document.createElement("td");
      department.className = "department-cell";
      const departmentText = document.createElement("span");
      departmentText.textContent = contact.orgPath;
      departmentText.title = contact.orgPath;
      department.appendChild(departmentText);
      const position = createCell("", contact.positionName);
      const mobile = document.createElement("td");
      const mobileButton = document.createElement("button");
      mobileButton.type = "button";
      mobileButton.className = "mobile-link";
      mobileButton.textContent = contact.mobile;
      mobileButton.title = "点击复制手机号";
      mobileButton.addEventListener("click", () => copyMobile(contact.mobile));
      mobile.appendChild(mobileButton);
      row.append(selection, name, mobile, department, position);
      dom.contactsBody.appendChild(row);
    });
    updateSelectionUi();
    dom.emptyState.hidden = state.currentRows.length !== 0;
    dom.listHeading.hidden = state.selectedOrgId === "all" && !state.name && !state.positionKeyword;
    dom.resultCountHeading.textContent = `（共 ${state.total} 人）`;
    dom.totalCount.textContent = `共 ${state.total} 条`;
  }

  function renderPagination() {
    dom.pageNumbers.innerHTML = "";
    paginationItems(state.pageNo, state.totalPages).forEach(item => {
      if (item === "...") {
        const ellipsis = document.createElement("span");
        ellipsis.className = "page-ellipsis";
        ellipsis.textContent = "...";
        dom.pageNumbers.appendChild(ellipsis);
      } else {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `page-button ${item === state.pageNo ? "active" : ""}`;
        button.textContent = item;
        button.setAttribute("aria-current", item === state.pageNo ? "page" : "false");
        button.addEventListener("click", () => goToPage(item));
        dom.pageNumbers.appendChild(button);
      }
    });
    dom.prevPage.disabled = state.pageNo <= 1;
    dom.nextPage.disabled = state.pageNo >= state.totalPages;
    dom.pageJumpInput.max = String(state.totalPages);
    dom.pageJumpInput.value = String(state.pageNo);
  }

  function goToPage(page) {
    const next = Math.max(1, Math.min(state.totalPages, Number(page) || 1));
    if (next === state.pageNo) { dom.pageJumpInput.value = String(state.pageNo); return; }
    state.pageNo = next;
    loadContacts();
  }

  function setTableLoading(loading) {
    state.loading = loading;
    dom.tableLoading.hidden = !loading;
    dom.searchForm.querySelectorAll("button").forEach(button => button.disabled = loading);
    dom.selectPageCheckbox.disabled = loading || state.currentRows.length === 0;
  }

  function toggleContactSelection(contactId, selected) {
    if (selected) state.selectedContactIds.add(contactId);
    else state.selectedContactIds.delete(contactId);
    renderContacts();
  }

  function toggleCurrentPageSelection(event) {
    state.currentRows.forEach(contact => {
      if (event.currentTarget.checked) state.selectedContactIds.add(contact.id);
      else state.selectedContactIds.delete(contact.id);
    });
    renderContacts();
  }

  function updateSelectionUi() {
    const selectedOnPage = state.currentRows.filter(contact => state.selectedContactIds.has(contact.id)).length;
    dom.selectPageCheckbox.checked = state.currentRows.length > 0 && selectedOnPage === state.currentRows.length;
    dom.selectPageCheckbox.indeterminate = selectedOnPage > 0 && selectedOnPage < state.currentRows.length;
    dom.selectPageCheckbox.disabled = state.loading || state.currentRows.length === 0;
    const count = state.selectedContactIds.size;
    dom.selectedCount.hidden = count === 0;
    dom.selectedCount.textContent = `已选择 ${count} 人`;
    dom.exportButtonLabel.textContent = count > 0 ? "导出已选" : "导出";
  }

  function clearSelection(announce = false) {
    if (!state.selectedContactIds.size) return;
    state.selectedContactIds.clear();
    updateSelectionUi();
    if (announce) showToast("筛选条件已变化，已清空所选人员");
  }

  async function copyMobile(mobile) {
    try {
      await navigator.clipboard.writeText(mobile);
    } catch (_) {
      const input = document.createElement("textarea");
      input.value = mobile;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    showToast("手机号已复制");
  }

  function openExportModal() {
    const selectedCount = state.selectedContactIds.size;
    dom.exportDialogDescription.textContent = selectedCount
      ? `将导出已选择的 ${selectedCount} 人，是否继续？`
      : `将导出当前筛选结果，共 ${state.total} 人，是否继续？`;
    dom.exportModal.hidden = false;
    dom.confirmExport.focus();
  }

  function closeExportModal() {
    if (!dom.exportModal.hidden) {
      dom.exportModal.hidden = true;
      dom.exportButton.focus();
    }
  }

  async function confirmExport() {
    dom.confirmExport.disabled = true;
    dom.confirmExport.textContent = "正在导出...";
    try {
      const selectedIds = Array.from(state.selectedContactIds);
      const blob = await ContactApi.exportContacts({ ...currentQueryParams(), selectedIds });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `企业通讯录_${formatDate(new Date())}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      closeExportModal();
      showToast(selectedIds.length ? `已导出 ${selectedIds.length} 名所选人员` : "通讯录已导出");
    } finally {
      dom.confirmExport.disabled = false;
      dom.confirmExport.textContent = "确认导出";
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 1800);
  }

  function createMockContacts(count) {
    const contacts = [];
    const engineeringLeaves = ["eng-quality", "wuhan", "ezhou", "huangshi", "xiangyang", "yichang"];
    const otherLeaves = leafOrgIds.filter(id => !engineeringLeaves.includes(id));
    for (let index = 0; index < count; index += 1) {
      const orgId = index < 86 ? engineeringLeaves[index % engineeringLeaves.length] : otherLeaves[(index - 86) % otherLeaves.length];
      const name = fixedNames[index] || `${surnames[index % surnames.length]}${givenNames[(index * 2) % givenNames.length]}${givenNames[(index * 3 + 5) % givenNames.length]}`;
      const orgNode = findOrg(orgId);
      contacts.push({
        id: `contact-${index + 1}`,
        name,
        orgId,
        orgPath: buildOrgPath(orgNode),
        positionName: positions[index % positions.length],
        mobile: String(13800130000 + index * 101),
        accountCreatedAt: new Date(2018, 0, 5 + index).toISOString(),
        status: index >= count - 6 ? "离职" : "在岗"
      });
    }
    return contacts;
  }

  function collectLeafOrgIds(node, result = []) {
    if (!node.children || !node.children.length) {
      if (node.id !== "all" && node.id !== "company") result.push(node.id);
      return result;
    }
    node.children.forEach(child => collectLeafOrgIds(child, result));
    return result;
  }

  function collectOrgIds(node, result = []) {
    if (!node) return result;
    result.push(node.id);
    (node.children || []).forEach(child => collectOrgIds(child, result));
    return result;
  }

  function findOrg(id, node = organizationTree[0], ancestors = []) {
    if (!node) return null;
    if (node.id === id) return { ...node, ancestors };
    for (const child of node.children || []) {
      const found = findOrg(id, child, [...ancestors, node.id]);
      if (found) return found;
    }
    return null;
  }

  function buildOrgPath(node) {
    if (!node) return "";
    const ids = [...node.ancestors, node.id].filter(id => id !== "all");
    return ids.map(id => findOrg(id)?.name).filter(Boolean).join("-");
  }

  function expandAncestors(id, set) {
    const node = findOrg(id);
    if (node) node.ancestors.forEach(parentId => set.add(parentId));
  }

  function toggleSet(set, value) { set.has(value) ? set.delete(value) : set.add(value); }
  function createCell(className, text) { const cell = document.createElement("td"); cell.className = className; cell.textContent = text; return cell; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function formatDate(date) { return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`; }

  function paginationItems(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  function createXlsxBlob(rows) {
    const sheetRows = [["姓名", "所属部门", "职务", "手机号"], ...rows.map(item => [item.name, item.orgPath, item.positionName, item.mobile])];
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/><col min="3" max="3" width="22" customWidth="1"/><col min="4" max="4" width="18" customWidth="1"/></cols><sheetData>${sheetRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, colIndex) => `<c r="${columnName(colIndex)}${rowIndex + 1}" t="inlineStr"${rowIndex === 0 ? " s=\"1\"" : ""}><is><t>${escapeXml(String(value))}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
    const files = {
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="通讯录" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B63CE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
      "xl/worksheets/sheet1.xml": sheetXml
    };
    return new Blob([createZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function columnName(index) {
    let name = "";
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
  }

  function escapeXml(value) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char])); }

  function createZip(fileMap) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    Object.entries(fileMap).forEach(([name, content]) => {
      const nameBytes = encoder.encode(name);
      const data = encoder.encode(content);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length + data.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
      lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30); local.set(data, 30 + nameBytes.length); localParts.push(local);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
      central.set(nameBytes, 46); centralParts.push(central); offset += local.length;
    });
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, centralParts.length, true); ev.setUint16(10, centralParts.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
    return concatBytes([...localParts, ...centralParts, end]);
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let cursor = 0;
    parts.forEach(part => { result.set(part, cursor); cursor += part.length; });
    return result;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
})();
