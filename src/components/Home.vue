<template>
	<el-tabs model-value="Data" stretch>
		<el-tab-pane label="票据信息" name="Data">
			<el-table ref="multipleTableRef" :data="tableData" :size="screenSize.height < 500 ? 'small' : 'default'"
				:height="screenSize.height - 110" :style="{ 'width': `${screenSize.width - 50}px` }" border stripe
				highlight-current-row :header-cell-style="{ 'text-align': 'center' }" :summary-method="tableSummary"
				show-summary @sort-change="tableSort">
				<el-table-column type="expand" key="expand" width="30" align="center" fixed>
					<template #default="props">
						<el-form :size="screenSize.height < 500 ? 'small' : 'default'" label-position="right"
							label-width="200px" :style="{ 'max-width': `${screenSize.width - 70}px` }" label-suffix="：">
							<el-form-item label="路径">
								<el-input :value="props.row.path">
									<template #prefix>
										<el-image style="width: 20px; height: 20px"
											:src="props.row.element?.canvas.toDataURL('image/jpg')" fit="cover"
											loading="lazy" :preview-src-list="props.row.element?.srcList"
											preview-teleported />
									</template>
								</el-input>
							</el-form-item>
							<el-form-item label="表外">
								<el-input type="textarea" autosize :value="props.row._text.value"></el-input>
							</el-form-item>
							<el-form-item v-for="(v, i) in props.row._cells" :key="i" :label="v.label">
								<el-input type="textarea" autosize :value="v.value"></el-input>
							</el-form-item>
						</el-form>
					</template>
				</el-table-column>
				<el-table-column key="path" type="selection" width="38" align="center" fixed />
				<el-table-column key="oldname" prop="oldname" label="旧文件名" min-width="300" sortable="custom" fixed
					show-overflow-tooltip />
				<el-table-column key="pageNo" prop="pageNo" label="页码" width="50" align="center" fixed
					show-overflow-tooltip />
				<el-table-column key="newname" label="新文件名" min-width="300" sortable="custom" fixed show-overflow-tooltip>
					<template #default="props">
						{{ newName(props) }}
					</template>
				</el-table-column>
				<el-table-column key="more" label="结果">
					<el-table-column v-for="(item,) in tableHead" :key="item.id" :label="item.label"
						:align="item.align ?? 'left'" :width="item.width ?? 150"
						:show-overflow-tooltip="item.tooltip ?? true" sortable="custom">
						<template #default="props">
							{{ item.render(props) }}
						</template>
					</el-table-column>
				</el-table-column>
			</el-table>
			<el-space alignment="center" :style="{ 'margin-top': '5px' }">
				<el-upload ref="uploadRef" action="#" multiple :auto-upload="true" :file-list="fileLists"
					:show-file-list="false" :before-remove="beforeFilesRemove" :on-change="handleChange"
					:http-request="uploadFilesXhr">
					<el-button type="primary" round>读取文件</el-button>
				</el-upload>
				<el-button type="primary" @click="removeSelectedRows" round>清空所选</el-button>
				<el-button type="primary" @click="saveAsSubFiles" round>分页下载</el-button>
				<el-button type="primary" @click="saveAsFiles" round>合并下载</el-button>
				<download-excel :fields="exportDataHeader()" :fetch="fetchTableData" type="csv" :name='`exportdata.csv`'
					stringifyLongNum>
					<el-button type="primary" round>导出表格</el-button>
				</download-excel>
			</el-space>
		</el-tab-pane>
		<!-- <el-tab-pane label="参数设置" name="GlobalSetting">
			<div :style="{ 'width': `${screenSize.width - 50}px`, 'height': `${screenSize.height - 150}px` }">
				<el-form label-suffix="：" label-position="right" label-width="100">
					<el-form-item label="编辑器主题">
						<el-select v-model="ScriptSetting.theme" placeholder="请选择界面主题">
							<el-option label="明亮模式(Visual Studio)" value="vs" />
							<el-option label="暗黑模式(Visual Studio Dark)" value="vs-dark" />
							<el-option label="深黑模式(High Contrast Dark)" value="hc-black" />
						</el-select>
					</el-form-item>
					<el-form-item label="渲染间隔">
						<el-input placeholder="请输入">
							<template #append>
								<el-select value="1" placeholder="单位" style="width: 115px">
									<el-option label="毫秒" value="1" />
									<el-option label="秒" value="100" />
								</el-select>
							</template>
						</el-input>
					</el-form-item>
					<el-form-item label="行扩展显示">
						<el-switch />
					</el-form-item>
				</el-form>
			</div>
			<el-space alignment="center" :style="{ 'margin-top': '10px' }">
				<el-button type="primary" @click="" round>保存修改</el-button>
				<el-button type="primary" @click="" round>取消修改</el-button>
			</el-space>
		</el-tab-pane> -->
		<el-tab-pane label="脚本设置" name="ScriptSetting">
			<monacoEditor v-model="ScriptSetting.value" :language="ScriptSetting.language" :style="{ 'text-align': 'left' }"
				:width="`${screenSize.width - 50}px`" :height="`${screenSize.height - 110}px`"
				v-bind:theme="ScriptSetting.theme" @editor-mounted="ScriptSetting.editorMounted"
				@change="handleEditorChange" />
			<el-space alignment="center" :style="{ 'margin-top': '5px' }">
				<el-button type="primary" @click="ScriptSetting.btnFunctions.save" round>保存</el-button>
				<el-button type="primary" @click="ScriptSetting.btnFunctions.cancel" round>取消</el-button>
				<el-button type="primary" @click="ScriptSetting.btnFunctions.reset" round>重置</el-button>
				<el-button type="primary" @click="ScriptSetting.btnFunctions.delete" round>删除</el-button>
				<!-- <el-button type="primary" @click="ScriptSetting.btnFunctions.import" round>导入</el-button> -->
				<el-button type="primary" @click="ScriptSetting.btnFunctions.output" round>导出</el-button>
			</el-space>
		</el-tab-pane>
	</el-tabs>
	<div id="preview-cache"></div>
</template>

<script lang="ts">
// import Tesseract from 'tesseract.js'
import { ref } from 'vue'
import { ElTable, UploadRequestOptions } from 'element-plus'

import { saveAs } from 'file-saver'

import * as monaco from 'monaco-editor'
import monacoEditor from './monacoEditor.vue'
import { PDFUtils } from '../utils/PDFUtils'
import { OFDUtils, jq } from '../utils/OFDUtils'
import JSZip from 'jszip'

const fileUrl: any = {}

let computedFields = {
	tableHead: () => {
		return [
			{
				id: 'text',
				label: '全文',
				align: 'center',
				width: 200,
				tooltip: false,
				render: (props: any) => props.row._text.value
			}
		]
	},
	newName: (prop: any) => {
		return prop.row.oldname
	},
	tableSort: ({ column, prop, order }: any) => {
		let collator = new Intl.Collator('zh-Hans-CN', { numeric: true })
		let key = column.rawColumnKey
		let ascend = order == 'ascending' ? 1 : -1
		this.tableData = this.tableData.sort((a: any, b: any) => {
			return collator.compare(a[key], b[key]) * ascend
		})
	}
}

export default {
	name: 'Home',
	components: {
		monacoEditor
	},
	data() {
		window.onresize = () => {
			this.screenSize = {
				width: window.innerWidth,
				height: window.innerHeight
			}
		}

		if (window.utools != null) {
			utools.onPluginEnter((param: any) => {
				let { code, type, payload, option } = param
				if (type == 'files')
					this.parseFiles(payload)
			})
		}



		return {
			screenSize: {
				width: window.innerWidth,
				height: window.innerHeight
			},
			fileLists: [],
			fileUrl: {},
			tableHead: computedFields.tableHead(),
			newName: computedFields.newName,
			tableSort: computedFields.tableSort,
			tableData: [{
				pageNo: 0,
				page: null,
				element: null,
				path: '',
				oldname: '',
				_text: { value: '' },
				_cells: [{
					id: '',
					label: '',
					value: '',
				}],
				_empty: true
			}].filter((v: any) => !v._empty),
			ScriptSetting: {
				value: ref(''),
				log: ref('初始化成功'),
				language: 'javascript',
				editorMounted: (editor: monaco.editor.IStandaloneCodeEditor) => { },
				btnFunctions: {
					read: (isdefault = false) => {
						let exportConfig = localStorage.getItem('exportConfig')
						if (exportConfig == null || isdefault)
							jq.ajax({
								url: 'static/export.config.default.js',
								async: false,
								dataType: 'text',
								success: (data: any) => {
									exportConfig = data
								}
							})
						if (exportConfig) {
							this.ScriptSetting.value = exportConfig
							eval(exportConfig)
							this.tableHead = computedFields.tableHead()
							this.newName = computedFields.newName
							this.tableSort = computedFields.tableSort
						}
					},
					save: () => {
						localStorage.setItem('exportConfig', this.ScriptSetting.value)
						this.ScriptSetting.btnFunctions.read()
						this.$message({
							message: '配置保存完毕',
							type: 'success'
						})
					},
					cancel: () => {
						this.ScriptSetting.btnFunctions.read()
						this.$message({
							message: '取消修改',
							type: 'success'
						})
					},
					reset: () => {
						this.ScriptSetting.btnFunctions.read(true)
						this.$message({
							message: '重置完毕, 保存后可覆盖现配置',
							type: 'warning'
						})
					},
					delete: () => {
						localStorage.removeItem('exportConfig')
						this.ScriptSetting.btnFunctions.read()
						this.$message({
							message: '已删除并重置配置',
							type: 'error'
						})
					},
					import: () => {

					},
					output: () => {
						saveAs(new Blob([localStorage.getItem('exportConfig')], { type: 'text/plain;charset=utf-8' }), 'export.config.js')
					}
				},
				theme: ref('vs-dark')
			}
		}
	},
	mounted() {
		this.ScriptSetting.btnFunctions.read()
	},
	watch: {

	},
	methods: {
		recognizeText() {

		},
		parseFiles(payload: any[]) {
			for (const item of payload) {
				if (item['isFile'] && !this.tableData.some((row: any) => row.path == item.path)) {
					if (item['name'].endsWith('.pdf')) {
						PDFUtils.readPDFDoc(item['path'].replace(/\\/g, '/'), (e: any) => {
							let row = {
								pageNo: e.pageNo,
								element: e.element,
								path: item['path'],
								oldname: item['name'],
								type: 'pdf',
								_text: {
									value: e.rangeText.texts?.map((x: any) => (x) instanceof Array ? x?.map((v: any) => v.str).join('') : x?.str).join('\n'),
									texts: e.rangeText.texts,
								},
								_cells: e.rangeText.cells.map((v: any, i: number) => {
									let name = `Cell_${i}`
									return {
										id: name,
										label: name,
										value: v.texts?.map((x: any) => (x) instanceof Array ? x?.map((v: any) => v.str).join('') : x?.str).join('\n'),
										...v
									}
								}),
								_empty: false
							}
							console.log(row)
							this.tableData.push(row)
						})
					}
					else if (item['name'].endsWith('.ofd')) {
						fetch(item['path']).then((res) => {
							res.arrayBuffer().then(arr => {
								let ofd = new OFDUtils(arr)
								ofd.then((v: OFDUtils) => {
									v.pages.map((v, i) => {
										let row = {
											pageNo: i + 1,
											element: v.element,
											path: item['path'],
											oldname: item['name'],
											type: 'ofd',
											_text: {
												value: '',
												texts: [],
											},
											_cells: v.texts.map((val: any, i: number) => {
												return {
													id: i,
													label: val.name,
													value: val.value,
												}
											}),
											_empty: false
										}
										console.log(row)
										this.tableData.push(row)
									})
								})
							})
						})
					}
					// else if (/\.(jpe?g|png)$/g.test(item['name'])) {
					// 	fetch(item['path']).then((res) => {
					// 		res.blob().then(blob => {
					// 			let img = new Image()
					// 			img.src = URL.createObjectURL(blob)
					// 			img.onload = (event) => {
					// 				let canvas = document.createElement('canvas')
					// 				canvas.width = img.width
					// 				canvas.height = img.height
					// 				let ctx = canvas.getContext('2d')
					// 				ctx?.drawImage(img, 0, 0, img.width, img.height)

					// 				let src = new ImgUtils(canvas)
					// 				let scale = 1
					// 				let { rects, srcList } = ImgUtils.findRects(src, scale)
					// 				let row = {
					// 					pageNo: 1,
					// 					element: { canvas: canvas, scale: 1, srcList: Object.values(srcList) },
					// 					path: item['path'],
					// 					oldname: item['name'],
					// 					type: 'img',
					// 					_text: {
					// 						value: '',
					// 						texts: [],
					// 					},
					// 					_cells: [],
					// 					_empty: false
					// 				}
					// 				console.log(row)
					// 				this.tableData.push(row)
					// 			}
					// 		})
					// 	})
					// }
				}
			}
		},
		async saveAsSubFiles() {
			let selected = this.$refs.multipleTableRef.getSelectionRows()
			selected = selected.length == 0 ? this.tableData : selected
			if (selected.length > 0) {
				let zip = new JSZip()
				let files: any = {}
				for (let i = 0; i < selected.length; i++) {
					let row = selected[i]
					if (row.oldname.endsWith('.pdf')) {
						if (!(row.path in files)) {
							files[row.path] = []
							let docs = await PDFUtils.splitPDF(row.path)
							let selectedPages = selected.filter(v => v.path == row.path)
							for (let pi = 0; pi < selectedPages.length; pi++) {
								files[row.path].push({
									blob: new Blob([await docs[selectedPages[pi].pageNo - 1].save()]),
									name: this.newName({ row: selectedPages[pi], column: this.tableHead, index: i + pi })
								})
							}
						}
					} else {
						if (!(row.path in files)) {
							files[row.path] = [{
								blob: await new Promise(resolve => row.element.canvas.toBlob(resolve)),
								name: this.newName({ row: row, column: this.tableHead, index: i }).replace(/[^\.]+$/, 'png')
							}]
						}
					}
				}
				Object.entries(files).forEach((v: any[]) => v[1].forEach((item: any) => {
					zip.file(item.name, item.blob, { binary: true })
				}))
				let content = await zip.generateAsync({ type: "blob" })
				saveAs(new Blob([content]), `split.zip`)
			}
		},
		saveAsFiles() {
			let selected = this.$refs.multipleTableRef.getSelectionRows()
			selected = selected.length == 0 ? this.tableData : selected
			if (selected.length > 0) {
				let filespath = new Set()
				let files = []
				for (let i = 0; i < selected.length; i++) {
					let row = selected[i]
					if (!filespath.has(row.path)) {
						filespath.add(row.path)
						if (row.oldname.endsWith('.pdf'))
							files.push({
								url: row.path,
								type: 'pdf',
								pageNos: new Set(selected.filter(v => v.path == row.path).map(v => v.pageNo - 1))
							})
						else
							files.push({
								url: row.element.canvas.toDataURL(),
								type: 'image',
								scale: 0.5
							})
					}
				}
				PDFUtils.merge(files).then(async doc => {
					let bytes = await doc.save()
					saveAs(new Blob([bytes]), 'merge.pdf')
				})
			}
		},
		exportDataHeader() {
			let fields = {
				"旧文件名": 'oldname',
				"新文件名": 'newname',
				"页码": 'pageNo',
				"路径": 'path'
			}
			this.tableHead.forEach((v) => {
				fields = {
					...fields,
					[v.label]: v.id
				}
			})
			return fields
		},
		fetchTableData() {
			return this.tableData.map((v, i) => {
				let row: any = {
					...v,
					'newname': this.newName({ row: v, column: this.tableHead, index: i })
				}
				this.tableHead.forEach((col, i) => {
					row[col.id] = col.render({ row: row, column: col, index: i })
				})
				return row
			})
		},
		tableSummary(param: any) {
			const { columns, data } = param
			const sums: any[] = []

			columns.forEach((column: any, index: number) => {
				let selected: any[] = this.$refs.multipleTableRef.getSelectionRows()
				if (index === 2) {
					sums[index] = `合计 (选中${selected.length}行/共${this.tableData.length}行)`
					return
				}
				let total: any = this.tableHead.find(v => v.id == column.rawColumnKey)?.total
				if (total) {
					sums[index] = total(selected.length == 0 ? param : { columns: columns, data: selected })
				}
			})
			return sums
		},
		beforeFilesRemove(file: any, fileLists: any[]) {
			return this.$confirm(`确定移除 ${file.name}？`);
		},
		handleChange(file: any, fileLists: any[]) {
			if (file) {
				fileUrl[file.uid] = URL.createObjectURL(file.raw)
			}
		},
		uploadFilesXhr(options: UploadRequestOptions) {
			// console.log(options)
			let { file } = options

			this.parseFiles([{
				isDirectory: false,
				isFile: true,
				path: fileUrl[file.uid],
				name: file.name
			}])
		},
		handleEditorChange(value: any) {
			// console.log(value)
		},
		removeSelectedRows() {
			let rows = this.$refs.multipleTableRef.getSelectionRows()
			if (rows) {
				this.tableData = this.tableData.filter((v) => !rows.some(r => r.path == v.path))
				this.$message({
					message: `清空${rows.length ?? 0}行`,
					type: 'success'
				})
			}
		}
	}
}
</script>

<style scoped>
.el-header {
	padding: 0 0;
}
</style>