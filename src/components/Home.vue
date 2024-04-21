<template>
	<el-space alignment="center" :style="{ 'margin': '10px' }">
		<el-upload ref="uploadRef" action="#" multiple :auto-upload="true" :file-list="fileLists" :show-file-list="false"
			:before-remove="beforeFilesRemove" :on-change="handleChange" :http-request="uploadFilesXhr">
			<el-button type="primary" round>上传文件</el-button>
		</el-upload>
		<el-button type="primary" @click="renameFiles" round>重命名</el-button>
		<el-button type="primary" round>打开设置</el-button>
		<download-excel :fields="exportDataHeader()" :fetch="fetchTableData" :name='`exportdata.xlsx`' stringifyLongNum
			style="display: inline-flex;margin-left: 12px;">
			<el-button type="primary" round>导出表格</el-button>
		</download-excel>
	</el-space>
	<!-- <div>
		<canvas id="pdfpreview" />
	</div>
	<div>
		<img id="imgpreview_1" :style="{ 'width': `${Math.round((screenSize.width - 60) / 3)}px`, 'margin': '2px' }" />
		<img id="imgpreview_2" :style="{ 'width': `${Math.round((screenSize.width - 60) / 3)}px`, 'margin': '2px' }" />
		<img id="imgpreview_3" :style="{ 'width': `${Math.round((screenSize.width - 60) / 3)}px`, 'margin': '2px' }" />
	</div> -->
	<el-space>
		<el-table :data="tableData" :size="screenSize.height < 500 ? 'small' : 'default'" :height="screenSize.height - 100"
			:style="{ 'width': `${screenSize.width - 50}px` }" border stripe highlight-current-row
			:header-cell-style="{ 'text-align': 'center' }" :summary-method="getSum" show-summary>
			<el-table-column type="expand" key="expand" width="30" align="center">
				<template #default="props">
					<el-form :size="screenSize.height < 500 ? 'small' : 'default'" label-position="right"
						label-width="100px" :style="{ 'max-width': `${screenSize.width - 70}px` }" label-suffix="：">
						<el-form-item label="路径">
							<el-input :value="props.row.path">
								<template #prefix>
									<el-image style="width: 12px; height: 12px"
										:src="props.row.element.canvas.toDataURL('image/jpg')" fit="cover" loading="lazy"
										:preview-src-list="props.row.element.srcList" preview-teleported />
								</template>
							</el-input>
						</el-form-item>
						<el-form-item label="表外">
							<el-input type="textarea" autosize :value="props.row._text.value"></el-input>
						</el-form-item>
						<el-form-item v-for="(val, i) in props.row._cells" :key="i" :label="val.label">
							<el-input style="width: 100%" :value="val.value">
								<template #prefix>
									<el-image style="width: 12px; height: 12px" :src="val.src" fit="cover" loading="lazy"
										:preview-src-list="[val.src]" preview-teleported />
								</template>
							</el-input>
						</el-form-item>
					</el-form>
				</template>
			</el-table-column>
			<el-table-column key="path" type="selection" width="38" align="center" />
			<el-table-column key="oldname" prop="oldname" label="旧文件名" min-width="300" sortable />
			<el-table-column key="pageNo" prop="pageNo" label="页码" width="50" align="center" />
			<el-table-column key="more" label="识别结果" show-overflow-tooltip>
				<el-table-column v-for="(item,) in tableHead" :key="item.id" :prop="item.id" :label="item.label"
					:align="item.align ?? 'left'" :width="item.width ?? 150">
					<template #default="props">
						{{ item.render(props) }}
					</template>
				</el-table-column>
			</el-table-column>
		</el-table>
	</el-space>
</template>

<script lang="ts">
// import Tesseract from 'tesseract.js'
import type { UploadRequestOptions } from 'element-plus'
import cv from '@techstark/opencv-js'
// import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.mjs'
import * as PDFJS from 'pdfjs-dist'
PDFJS.GlobalWorkerOptions.workerSrc = 'static/pdfjs/pdf.worker.js'

const __debug__ = false
const Debug = {
	log: (...param: any) => {
		if (__debug__)
			console.log(param)
	},
	exec: (callback: Function) => {
		if (__debug__)
			callback()
	}
}

const sleep = (time: number) => {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(time)
		}, time)
	})
}

class nparray {
	data: any[]
	row: number
	col: number

	constructor(arr: any[]) {
		this.data = [...arr]
		this.row = this.data.length
		this.col = Math.max(...(this.data.map(v => v instanceof Array ? v.length : 1)))
	}

	reshape(row: number, col: number) {
		let newArr = []
		for (let r = 0; r < row; r++)
			newArr[r] = this.data.slice(r * col, (r + 1) * col)
		return new nparray(newArr)
	}

	tolist() {
		return [...this.data]
	}

	static array(arr: any[]) {
		return new nparray(arr)
	}
}

class ImgUtils {
	raw: cv.Mat
	gray: cv.Mat
	binary: cv.Mat

	constructor(src: any) {
		this.raw = cv.imread(src)
		this.gray = this.toGray(this.raw)
		let blur = this.toBlur(this.gray)
		this.binary = this.toBinary(blur)
		blur.delete()
		// document.getElementById('imgpreview_1')?.setAttribute('src', ImgUtils.toDataURL(this.raw))
	}

	toGray(src: cv.Mat) {
		let dst = new cv.Mat()
		cv.cvtColor(src, dst, cv.COLOR_BGR2GRAY)
		return dst
	}
	toBlur(src: cv.Mat) {
		let dst = new cv.Mat()
		let ksize = new cv.Size(3, 3)
		cv.GaussianBlur(src, dst, ksize, 0, 0, cv.BORDER_DEFAULT)

		return dst
	}
	toBinary(src: cv.Mat) {
		let dst = new cv.Mat()
		cv.adaptiveThreshold(src, dst, 200, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 3, 2)
		return dst
	}
	delete() {
		this.raw.delete()
		this.gray.delete()
		this.binary.delete()
	}
	static toDataURL(mat: cv.Mat, isDelete = false) {
		let canvas = document.createElement('canvas')
		cv.imshow(canvas, mat)
		if (isDelete)
			mat.delete()
		return canvas.toDataURL('image/jpg')
	}

	static erode(src: cv.Mat, kernel: cv.Mat) {
		let dst = new cv.Mat()
		let anchor = new cv.Point(-1, -1)
		cv.erode(src, dst, kernel, anchor, 1)
		return dst
	}
	static dilate(src: cv.Mat, kernel: cv.Mat) {
		let dst = new cv.Mat()
		let anchor = new cv.Point(-1, -1)
		cv.dilate(src, dst, kernel, anchor, 2, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())
		return dst
	}
	static where(src: cv.Mat, compare: Function) {
		let y = []
		let x = []
		for (let c = 0; c < src.cols; c++) {
			for (let r = 0; r < src.rows; r++) {
				if (compare(src.ptr(r, c), { row: r, col: c }, src)) {
					y.push(r)
					x.push(c)
				}
			}
		}
		return { col: x, row: y }
	}
	static merge(a: cv.Mat, b: cv.Mat) {
		let dst = new cv.Mat()
		cv.add(a, b, dst)
		return dst
	}
	static bitwise_and(a: cv.Mat, b: cv.Mat) {
		let dst = new cv.Mat()
		cv.bitwise_and(a, b, dst)
		return dst
	}
	static parseTableLines(thresh: cv.Mat, scale = 1, cscale = 40, rscale = 20) {
		let row_kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(Math.floor(thresh.cols / (rscale * scale)), 1))
		let col_kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, Math.floor(thresh.rows / (cscale * scale))))

		let res = {
			row_lines: ImgUtils.dilate(ImgUtils.erode(thresh, row_kernel), row_kernel),
			col_lines: ImgUtils.dilate(ImgUtils.erode(thresh, col_kernel), col_kernel)
		}
		row_kernel.delete()
		col_kernel.delete()
		return res
	}
	static findRects(src: ImgUtils, scale = 1) {
		let { row_lines, col_lines } = ImgUtils.parseTableLines(src.binary, scale)
		let mask = ImgUtils.merge(row_lines, col_lines)
		let contours = new cv.MatVector()
		let hierarchy = new cv.Mat()
		cv.findContours(mask, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE) // 所有边框轮廓
		// cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE) // 外边框轮廓

		let filteredContours = new cv.MatVector()
		let rects = []
		for (let i = 0; i < contours.size(); i++) {
			let contour = contours.get(i)

			let area = cv.contourArea(contour)
			let approx = new cv.Mat()
			let approxCount = Math.round(0.02 * cv.arcLength(contour, true))
			cv.approxPolyDP(contour, approx, approxCount, true)
			let dataframe: number[][] = nparray.array([...approx.data32S])
				.reshape(approx.rows, 2).tolist()
				.sort((a: number[], b: number[]) => {
					return Math.abs(a[1] - b[1]) < 3 ? a[0] - b[0] : a[1] - b[1]
				})

			if (area > 50 * scale && ImgUtils.IsApproxReactangle(approx, dataframe)) {
				filteredContours.push_back(contour)
				let p = {
					x0: dataframe[0][0] - 2,
					y0: dataframe[0][1] - 2,
					x1: dataframe[3][0] + 2,
					y1: dataframe[3][1] + 2,
				}
				rects.push({
					pos: p,
					rect: new cv.Rect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0)
				})
			}
			approx.delete()
		}

		let dst = new cv.Mat.zeros(src.raw.rows, src.raw.cols, cv.CV_8UC3)
		cv.drawContours(dst, contours, -1, new cv.Scalar(0, 255, 0), 3)
		cv.drawContours(dst, filteredContours, -1, new cv.Scalar(0, 255, 0), 3)

		let srcList = {
			raw: ImgUtils.toDataURL(src.raw),
			// gray: ImgUtils.toDataURL(src.gray),
			// binary: ImgUtils.toDataURL(src.binary),
			// mask: ImgUtils.toDataURL(mask, true),
			// contours: ImgUtils.toDataURL(dst, true),
		}

		row_lines.delete()
		col_lines.delete()
		contours.delete()
		hierarchy.delete()
		filteredContours.delete()

		return {
			srcList: srcList,
			rects: rects.sort((a, b) => Math.abs(a.pos.y0 - b.pos.y0) < 3 ?
				Math.abs(a.pos.x0 - b.pos.x0) < 3 ?
					0 : a.pos.x0 - b.pos.x0 : a.pos.y0 - b.pos.y0
			)
		}
	}
	static IsApproxReactangle(approx: cv.Mat, dataframe: any) {
		let count = approx.rows
		let points = [...approx.data32S]
		if (count < 4) {
			Debug.log("轮廓不是矩形，顶点数量少于4", dataframe)
			return false
		}

		if (count > 4) {
			Debug.log("轮廓可能不是矩形，顶点数量超过4", dataframe)
			return false
		}

		const incline = (a: number, b: number) => Math.sqrt(a * a + b * b)
		const calcDistance = (p1: number[], p2: number[]) => {
			let dx = p2[0] - p1[0]
			let dy = p2[1] - p1[1]
			return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
		}
		const calcAngle = (dot_a: number[], dot_b: number[], dot_c: number[]) => {
			let a = incline(dot_b[0] - dot_c[0], dot_b[1] - dot_c[1])
			let b = incline(dot_a[0] - dot_c[0], dot_a[1] - dot_c[1])
			let c = incline(dot_a[0] - dot_b[0], dot_a[1] - dot_b[1])
			return Math.acos((b * b + c * c - a * a) / (2 * b * c)) * 180 / Math.PI
		}

		let lens = []
		for (let i = 0; i < count; i++) {
			let j = (i + 1) % count
			lens.push(Math.round(calcDistance(
				[points[i * 2], points[i * 2 + 1]],
				[points[j * 2], points[j * 2 + 1]],
			)))
		}
		let dmin = incline(lens[0] - lens[2], lens[1] - lens[3])
		let dmax = incline(Math.max(lens[0], lens[2]), Math.max(lens[1], lens[3]))
		if (dmin / dmax > 0.1) {
			Debug.log("轮廓不是矩形，边的长度差异太大", lens)
			return false
		}

		let angs = []
		for (let i = 0; i < count; i++) {
			let j = (i + 1) % count
			let k = (i + 3) % count
			angs.push(Math.round(calcAngle(
				[points[i * 2], points[i * 2 + 1]],
				[points[j * 2], points[j * 2 + 1]],
				[points[k * 2], points[k * 2 + 1]],
			)))
		}
		if (angs.some(v => Math.abs(v - 90) > 10)) {
			Debug.log("轮廓不是矩形，夹角差异直角太大", angs)
			return false
		}
		return true
	}
}

class PDFUtils {
	static CMAP_URL = 'static/pdfjs/cmaps/'
	static CMAP_PACKED = true

	constructor() {
	}

	static groupbyRow(arr: any[]) {
		let texts = [...(arr ?? [])]
		if (texts.length == 0)
			return { texts: texts, groups: {} }
		let count = 1
		texts[0].row = count
		for (let i = 1; i < texts.length; i++) {
			let a = texts[i - 1]
			let b = texts[i]
			if (Math.abs(a.center.y - b.center.y) > Math.max(a.height, b.height)) {
				count++
			}
			texts[i].row = count
		}
		let groups = texts.reduce((acc, v) => {
			if (!acc[v.row])
				acc[v.row] = []
			acc[v.row].push(v)
			return acc
		}, {})
		for (let k in groups)
			groups[k] = groups[k].sort((a: any, b: any) => a.x - b.x)
		return {
			texts: texts,
			groups: groups
		}
	}

	static async toCanvas(page: PDFJS.PDFPageProxy, scale = 1) {
		let canvas = document.createElement('canvas')
		// let canvas = document.getElementById('pdfpreview')
		let context = canvas.getContext('2d')
		let viewport = page.getViewport({
			scale: scale
		})
		canvas.height = viewport.height
		canvas.width = viewport.width

		await page.render({
			canvasContext: context,
			viewport: viewport
		})

		await sleep(200)
		return {
			canvas: canvas,
			viewport: viewport,
			scale: scale
		}
	}

	static async readPDFPage(doc: PDFJS.PDFDocumentProxy, pageNo: number, scale = 1) {
		let page = await doc.getPage(pageNo)
		let { canvas, viewport } = await PDFUtils.toCanvas(page, scale)

		// 获取文本内容并排序
		let tokenizedText = await page.getTextContent()
		let pageText = tokenizedText.items.map((token: any) => {
			let tr = PDFJS.Util.transform(
				PDFJS.Util.transform(viewport.transform, token.transform),
				[1, 0, 0, -1, 0, 0]
			)
			let [xt, yt] = PDFJS.Util.applyTransform([0, 0], tr)
			let width = token.width / 72 * 2.54 * 10
			let height = token.height / 72 * 2.54 * 10
			return {
				str: token.str,
				x: Math.round(xt * 100) / 100,
				y: Math.round(yt * 100) / 100,
				width: Math.round(width * 100) / 100,
				height: Math.round(height * 100) / 100,
				center: {
					x: Math.round((xt + width / 2) * 100) / 100,
					y: Math.round((yt + height / 2) * 100) / 100
				},
				src: token,
				tr: tr,
			}
		}).sort((a: any, b: any) => {
			let y0_max = Math.max(a.y, b.y)
			let y1_min = Math.min(a.y + a.width, b.y + b.width)
			if (Math.abs(a.center.y - b.center.y) <= Math.min(a.height, b.height)) {
				if ((y1_min - y0_max) / (Math.max(a.width, b.width)) > 0.5)
					return a.x - b.x // 按列排序
				else if (Math.abs(a.height - b.height) > Math.min(a.height, b.height))
					return b.height - a.height // 按字号排序
				else
					return Math.pow(a.center.y, 2) * Math.pow(a.x, 2) -
						Math.pow(b.center.y, 2) * Math.pow(b.x, 2) // 按原点距离排序
			}
			return a.y - b.y // 按行排序
		})
		// 通过表格框线分割单元格内文本内容
		let img = new ImgUtils(canvas)
		let { rects, srcList } = ImgUtils.findRects(img, scale)

		let textRange: any[] = []
		let outRange: any[] = pageText.filter((token: any) => {
			return !rects.map((v, i) => {
				if (v.pos.x0 <= token.center.x && v.pos.x1 >= token.center.x &&
					v.pos.y0 <= token.center.y && v.pos.y1 >= token.center.y) {
					textRange[i] = [...(textRange[i] ?? []), token]
					return true
				}
				return false
			}).some(v => v)
		})
		

		let cells = rects.map((v, i) => ({
			texts: textRange[i],
			groups: [],
			// ...PDFUtils.groupbyRow(textRange[i]),
			// src: ImgUtils.toDataURL(img.raw.roi(v.rect), true),
			src: '',
			range: v.pos
		}))
		img.delete()
		console.log(cells)

		return {
			pageNo: pageNo,
			element: { canvas: canvas, scale: scale, srcList: Object.values(srcList) },
			pageText: pageText,
			rangeText: { texts: outRange, cells: cells }
			// rangeText: { texts: PDFUtils.groupbyRow(outRange), cells: cells }
		}
	}

	static async readPDFDoc(file: any, resolve: Function) {
		console.log(file)
		PDFJS.getDocument({
			url: file,
			// data: data,
			cMapUrl: PDFUtils.CMAP_URL,
			cMapPacked: PDFUtils.CMAP_PACKED
		}).promise.then((doc) => {
			for (let pageNo = 1; pageNo <= doc.numPages; pageNo++)
				PDFUtils.readPDFPage(doc, pageNo, 2)
					.then(v => resolve(v))
					.catch((err) => console.error(err))
		}).catch((err) => {
			console.error(err)
		})

		// let doc = await PDFJS.getDocument({
		// 	url: file,
		// 	// data: data,
		// 	cMapUrl: PDFUtils.CMAP_URL,
		// 	cMapPacked: PDFUtils.CMAP_PACKED
		// }).promise
		// console.log(doc)
		// let pageTextPromises = []
		// for (let pageNo = 1; pageNo <= doc.numPages; pageNo++)
		// 	pageTextPromises.push(PDFUtils.readPDFPage(doc, pageNo, 1))
		// let pageTexts = await Promise.all(pageTextPromises)
		// doc.destroy()
		// pageTexts.map((v) => resolve(v))
	}
}

const fileUrl: any = {}
export default {
	name: 'Home',
	data() {
		console.clear()
		window.onresize = () => {
			this.screenSize = {
				width: window.innerWidth,
				height: window.innerHeight
			}
		}

		if (window.utools != null) {
			utools.onPluginEnter((param: any) => {
				let { code, type, payload, option } = param
				console.log(param)
				Debug.log(code, type, payload, option)
				if (type == 'files')
					this.parseFiles(payload)
			})
		}

		let tableComputedFields = [
			{
				id: 'invoiceId',
				label: '发票号码',
				align: 'center',
				width: 200,
				render: (props: any) => {
					const { row } = props
					return /发票号码[:：](?<id>[0-9]+)/g.exec(row._text.value)?.groups?.id
				},
			},
			{
				id: 'amount',
				label: '发票金额',
				align: 'right',
				render: (props: any) => {
					const { row } = props
					let calc = (row: any) => {
						let match = row._cells.find((v: any) => /小写.¥([0-9.]+)$|¥([0-9.]+).小写.$/g.test((v.value ?? '').trim()))
						return parseFloat(match?.value?.replace(/[^-0-9.]+/g, ''))
					}
					return calc(row).toFixed(2)
				},
				total: (param: any) => {
					const { data } = param
					let calc = (row: any) => {
						let match = row._cells.find((v: any) => /小写.¥([0-9.]+)$|¥([0-9.]+).小写.$/g.test((v.value ?? '').trim()))
						return parseFloat(match?.value?.replace(/[^-0-9.]+/g, ''))
					}
					return (data.map((row: any) => calc(row)).reduce((acc: any[], cur: any) => cur + acc, 0)).toFixed(2)
				}
			},
			{
				id: 'buyer',
				label: '购方名称',
				render: (props: any) => {
					const { row } = props
					let index = row._cells.findIndex((v: any) => /^购\n?买.*/g.test((v.value ?? '').trim()))
					let texts = row._cells[index + 1]?.groups
					if (index != -1)
						return Object.entries(texts ?? {})
							.map(([, v]: any[]) => v.map((x: any) => x.str.trim()).join(''))
							.find((v) => /名.*[:：]/g.test(v))?.replace(/^.*[:：]/g, '')
				},
			},
			{
				id: 'buyerId',
				label: '纳税人识别号',
				render: (props: any) => {
					const { row } = props
					let index = row._cells.findIndex((v: any) => /^购\n?买.*/g.test((v.value ?? '').trim()))
					let texts = row._cells[index + 1]?.groups
					if (index != -1)
						return Object.entries(texts ?? {})
							.map(([, v]: any[]) => v.map((x: any) => x.str.trim()).join(''))
							.find((v) => /税.*[:：]/g.test(v))?.replace(/^.*[:：]/g, '')
				},
			},
			{
				id: 'buyerAddress',
				label: '地址、电话',
				render: (props: any) => {
					const { row } = props
					let index = row._cells.findIndex((v: any) => /^购\n?买.*/g.test((v.value ?? '').trim()))
					let texts = row._cells[index + 1]?.groups
					if (index != -1)
						return Object.entries(texts ?? {})
							.map(([, v]: any[]) => v.map((x: any) => x.str.trim()).join(''))
							.find((v) => /地.*址.*[:：]/g.test(v))?.replace(/^.*[:：]/g, '')
				},
			},
			{
				id: 'buyerBank',
				label: '银行账号',
				render: (props: any) => {
					const { row } = props
					let index = row._cells.findIndex((v: any) => /^购\n?买.*/g.test((v.value ?? '').trim()))
					let texts = row._cells[index + 1]?.groups
					if (index != -1)
						return Object.entries(texts ?? {})
							.map(([, v]: any[]) => v.map((x: any) => x.str.trim()).join(''))
							.find((v) => /账.*号.*[:：]/g.test(v))?.replace(/^.*[:：]/g, '')
				},
			},
		]

		return {
			screenSize: {
				width: window.innerWidth,
				height: window.innerHeight
			},
			fileLists: [],
			fileUrl: {},
			tableHead: [...tableComputedFields],
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
			debug: __debug__
		}
	},
	watch: {},
	methods: {
		recognizeText() {

		},
		exportDataHeader() {
			let fields = {
				"旧文件名": 'oldname',
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
				let row = { ...v }
				this.tableHead.forEach((col, i) => {
					row = {
						...row,
						[col.id]: col.render({ row: row, column: col, index: i })
					}
				})
				return row
			})
		},
		renameFiles() {
		},
		getSum(param: any) {
			const { columns } = param
			const sums: any[] = []
			// Debug.log(columns, data)
			columns.forEach((column: any, index: number) => {
				if (index === 2) {
					sums[index] = '合计'
					return
				}
				if (/amount/.test(column.property)) {
					let total: any = this.tableHead.find(v => v.id == column.property)?.total
					sums[index] = total(param)
				}
			})
			return sums
		},
		beforeFilesRemove(file: any, fileLists: any[]) {
			Debug.log(file, fileLists)
			return this.$confirm(`确定移除 ${file.name}？`);
		},
		handleChange(file: any, fileLists: any[]) {
			Debug.log(file, fileLists)
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
		parseFiles(payload: any[]) {
			for (const item of payload) {
				if (item['isFile'] && !this.tableData.some((row: any) => row.path == item.path)) {
					PDFUtils.readPDFDoc(item['path'].replace(/\\/g, '/'), (e: any) => {
						console.log(e)
						let row = {
							pageNo: e.pageNo,
							page: e.page,
							element: e.element,
							path: item['path'],
							oldname: item['name'],
							_text: {
								// value: Object.entries(e.rangeText.texts.groups)?.map((x: any[]) => x[1].map((v: any) => v.str).join('')).join('\n'),
								value: e.rangeText.texts?.map((x: any) => x.str).join(''),
								texts: e.rangeText.texts,
							},
							_cells: e.rangeText.cells.map((v: any, i: number) => {
								let name = `Cell_${i}`
								return {
									id: name,
									label: name,
									// value: Object.entries(v.groups)?.map((x: any[]) => x[1].map((v: any) => v.str).join('')).join('\n'),
									value: v.texts?.map((v: any) => v.str).join(''),
									...v
								}
							}),
							_empty: false
						}
						Debug.log(row._text)
						this.tableData.push(row)
					})
				}
			}
		}
	}
}
</script>

<style></style>