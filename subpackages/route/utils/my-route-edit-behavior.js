module.exports = Behavior({
 data: {},
 methods: {
  // 判断编辑态是否真的有改动：
  // 只有内容结构发生变化，才算"未保存修改"。
  hasEditingChanges() {
   const currentSections = stripEditState(this.data.daySections || []);
   const originalSections = stripEditState(this.data.originalDaySections || []);
   return JSON.stringify(currentSections) !== JSON.stringify(originalSections);
  },

  // 丢弃当前编辑改动：
  // 普通路线恢复到进入编辑前；从路线规划页进入时直接返回上一页。
  discardRouteEdits() {
   if (this.data.fromPreview) {
    wx.navigateBack({
     delta: 1,
     fail: () => {
      wx.switchTab({ url: "/pages/wantgo/wantgo" });
     },
    });
    return;
   }
   const restored = syncDaySections(
    this.data.originalDaySections || [],
    this.data.cityInfo
   );

   this.setData({
    isEditing: false,
    dragging: false,
    dragDay: -1,
    dragIndex: -1,
    dragTouchStartY: 0,
    swipeDay: -1,
    swipeIndex: -1,
    swipeStartOffset: 0,
    daySections: restored,
    tabs: buildTabs(restored.length),
    summaryText: buildSummaryText(restored),
    hasRoutePlaces: flattenDaySections(restored).length > 0,
    sheetScrollTarget: "",
    currentTab: 0,
    placePickerVisible: false,
    placePickerDayIndex: -1,
    placeIntroVisible: false,
    navMapSheetVisible: false,
   });
   this.updateMapData(restored, this.data.cityInfo, this.data.currentMapDay);
   this.refreshMapPreview(restored, this.data.mapPreviewIndex);
  },
 },
});
