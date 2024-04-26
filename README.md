# 票据小助手

- 概要：基于javascript语言，读取电子票据内容

## 一、界面功能

- [x] 表格预设列函数编辑页（基于javascript语言）
- [x] 表格支持清空行
- [x] 表格支持合并预览图至单个PDF中

## 二、运行原理

### pdf电子文档

- [x] 使用pdf.js逐页读取电子票据；
- [x] 渲染为图片并用opencv分割单元格；
- [x] 对pdf文本排序分组，分为表内外文本；
- [x] 配置预设列取数函数，提取字段信息。

### ofd版式文件

- [x] 使用jszip库读取ofd版式文件压缩内容；
- [x] 依据OFD.xml逐项遍历xml文件；
- [x] 依据CustomTags.xml，标注Content.xml数据；
- [x] 配置预设列取数函数，提取字段信息。

## 三、待办事项

- [ ] 尚未适配：框线断裂、一票多页、纯图片格式
- [ ] 增加票据整理，使用提取的字段来重命名

## 四、更新记录

- v0.0.2 添加ofd版式文件支持，优化界面
- v0.0.1 初始化测试

## 五、引用仓库

- [utools-plugin-template](https://github.com/QC2168/utools-plugin-template)
- [opencv.js](https://github.com/TechStark/opencv-js)
- [pdf.js](https://github.com/mozilla/pdf.js)
- [jspdf.js](https://github.com/parallax/jsPDF)
- [ofd.js](https://github.com/DLTech21/ofd.js)
