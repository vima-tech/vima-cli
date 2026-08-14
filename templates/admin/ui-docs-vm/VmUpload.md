# VmUpload · 图片上传（控件 `upload`）

> 类：`vm-upload` `vm-upload-item` `vm-upload-add`

## 用途

四列九宫格的图片上传区。选图用 `wx.chooseMedia`，上传用 `wx.uploadFile`——
框架只提供排布与占位，不接管上传流程。

## 结构

```html
<view class="vm-field">
  <text class="vm-label">检查报告照片<text class="vm-label-optional">（最多 6 张）</text></text>
  <view class="vm-upload">
    <view class="vm-upload-item" wx:for="{{files}}" wx:key="*this" bindtap="onPreview" data-i="{{index}}">
      <image src="{{item}}" mode="aspectFill"
             style="position:absolute;inset:0;width:100%;height:100%" />
    </view>
    <view class="vm-upload-add" wx:if="{{files.length < 6}}" bindtap="onChoose">
      <text style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
                   color:var(--vm-text-faint);font-size:24px">＋</text>
    </view>
  </view>
</view>
```

`vm-upload-item` / `vm-upload-add` 用 `padding-top: 100%` 撑出正方形，
所以内部元素必须绝对定位。

## 不要这样用

- **不要用 `wx.chooseImage`**（已废弃），用 `wx.chooseMedia`。
- **上传中/失败必须有态**：在 `vm-upload-item` 上叠一层半透明遮罩 + `VmLoading` 的
  `vm-spinner`；只显示缩略图会让用户以为传成功了。
- 张数上限要在标签里写明，不要等用户选完第 7 张再报错。

## H5 端差异

选图用原生文件输入，不需要权限申请：

```html
<label class="vm-upload-add">
  <input type="file" accept="image/*" multiple hidden @change="onPick" />
  ＋
</label>
```

上传仍走 `request` 门面（`FormData`），不要直接 `fetch`——否则代码↔契约对账看不见它。
