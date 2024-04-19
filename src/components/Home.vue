<template>
	<div>
		<el-table :data="tableData" height="455px" size="small" stripe show-overflow-tooltip highlight-current-row
			:header-cell-style="{ 'text-align': 'center' }" style="width: 750px">
			<el-table-column type="expand" key="expand">
				<template #default="props">
					<el-form label-position="right" size="small" inline>
						<el-form-item label="路径" label-width="50px">
							<!-- <el-input :value=""></el-input> -->
							<span>{{ props.row.path }}</span>
						</el-form-item>
						<el-form-item label="表外" label-width="50px">
							<!-- <el-input :value="props.row.text"></el-input> -->
							<span>{{ props.row.text }}</span>
						</el-form-item>
						<el-form-item v-for="(val, i) in props.row._expander" :key="i" :label="val.label"
							label-width="50px">
							<!-- <el-input :value="val.value"></el-input> -->
							<span>{{ val.value }}</span>
						</el-form-item>
					</el-form>
				</template>
			</el-table-column>
			<el-table-column key="path" type="selection" width="55" />
			<el-table-column key="oldname" prop="oldname" label="旧文件名" width="120" sortable />
			<el-table-column key="newname" prop="newname" label="新文件名" width="120" sortable>
				<template #default="props">
					{{ props.row.newnameComputed(props.row) }}
				</template>
			</el-table-column>
			<el-table-column key="path" prop="path" label="路径" width="120" sortable />
			<el-table-column key="more" label="识别结果" show-overflow-tooltip>
				<el-table-column v-for="(item, i) in tableHead" :key="i" :prop="item.id" :label="item.label" width="285" />
			</el-table-column>
		</el-table>
		<div>
			<view>
				<canvas id='pdfpreview'></canvas>
			</view>
		</div>
		<div>
			<view v-for="(item, index) in images">
				<div>
					<canvas :id="`prev_${index}`" style="margin: 5px;"></canvas>
					<div>
						<span>{{ item.text }}</span>
					</div>
				</div>
			</view>
		</div>
		<div style="margin-top:15px;">
			<el-button type="primary" @click="recognizeText" round>全局</el-button>
			<el-button type="primary" @click="recognizeArea" round>区域</el-button>
			<el-button type="primary" @click="renameFiles" round>重命名</el-button>
			<el-button type="primary" round>设置</el-button>
			<download-excel :fields="exportConfig.fields" :data="tableData" :name='`exportdata.xlsx`'
				style="display: inline-flex;margin-left: 12px;">
				<el-button type="primary" round>导出</el-button>
			</download-excel>
		</div>
	</div>
</template>

<script>
const {
	fs,
	nj
} = window.api

import Tesseract from 'tesseract.js'
import * as PDFJS from 'pdfjs-dist/build/pdf.js'
PDFJS.GlobalWorkerOptions.workerSrc = 'static/pdfjs/pdf.worker.js'
import cv from '@techstark/opencv-js'
window.cv = cv
window.PDFJS = PDFJS

const CMAP_URL = 'static/pdfjs/cmaps/'
const CMAP_PACKED = true

function copyFile(oldpath, newpath) {
	const rs = fs.createReadStream(oldpath)
	const ws = fs.createWriteStream(newpath)

	rs.on('data', chunk => {
		ws.write(chunk)
	})
}

class ImgUtils {
	constructor(src) {
		this.raw = cv.imread(src)
		this.gray = this.toGray(this.raw)
		this.binary = this.toBinary(this.toBlur(this.gray))
	}

	toGray(src) {
		let dst = new cv.Mat()
		cv.cvtColor(src, dst, cv.COLOR_BGR2GRAY)
		return dst
	}
	toBlur(src) {
		let dst = new cv.Mat()
		let ksize = new cv.Size(3, 3)
		cv.GaussianBlur(src, dst, ksize, 0, 0, cv.BORDER_DEFAULT);
		return dst
	}
	toBinary(src) {
		let dst = new cv.Mat()
		// cv.threshold(src, dst, 200, 255, cv.THRESH_BINARY_INV)
		cv.adaptiveThreshold(src, dst, 200, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 3, 2)
		return dst
	}

	static async PDFtoCanvas(page, scale = 1) {
		var canvas = document.createElement('canvas')
		var ctx = canvas.getContext('2d')
		var viewport = page.getViewport({
			scale: scale
		})
		canvas.height = viewport.height
		canvas.width = viewport.width
		var success = await page.render({
			canvasContext: ctx,
			viewport: viewport
		}).promise
		return {
			canvas: canvas,
			viewport: viewport,
			scale: scale
		}
	}
	static merge(a, b) {
		let dst = new cv.Mat()
		cv.add(a, b, dst)
		return dst
	}
	static bitwise_and(a, b) {
		let dst = new cv.Mat()
		cv.bitwise_and(a, b, dst)
		return dst
	}
	static erode(src, kernel) {
		let dst = new cv.Mat()
		let anchor = new cv.Point(-1, -1)
		cv.erode(src, dst, kernel, anchor, 1)
		return dst
	}
	static dilate(src, kernel) {
		let dst = new cv.Mat()
		let anchor = new cv.Point(-1, -1)
		cv.dilate(src, dst, kernel, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())
		return dst
	}
	static where(src, callback) {
		let y = []
		let x = []
		for (let c = 0; c < src.cols; c++) {
			for (let r = 0; r < src.rows; r++) {
				if (callback(src.ptr(r, c), {
					row: r,
					col: c
				}, src)) {
					y.push(r)
					x.push(c)
				}
			}
		}
		return {
			col: x,
			row: y
		}
	}
	static convertTonpArray(cvMatrix) {
		return nj.array([...cvMatrix.data]).reshape(cvMatrix.rows, cvMatrix.cols)
	}

	static parseTableLines(thresh, scale = 1, cscale = 40, rscale = 20) {
		let {
			rows,
			cols
		} = thresh
		let kernel

		kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(Math.floor(cols / (rscale * scale)), 1))
		let row_lines = ImgUtils.dilate(ImgUtils.erode(thresh, kernel), kernel)
		kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, Math.floor(rows / (cscale * scale))))
		let col_lines = ImgUtils.dilate(ImgUtils.erode(thresh, kernel), kernel)
		let bitwise_and = ImgUtils.bitwise_and(row_lines, col_lines)
		let merge = ImgUtils.merge(row_lines, col_lines)

		return {
			row: row_lines,
			col: col_lines,
			point: ImgUtils.where(bitwise_and, (v) => v > 0),
			line: ImgUtils.where(merge, (v) => v > 0)
		}
	}
	static parseTableCells(xs, ys, scale = 1, margin_x = 3, margin_y = 3, dot_margin = 3) {
		// params_margin_x: x轴点相距达到一定的距离，才算两个有效点, 确定线的个数
		let params_margin_x = Math.floor(margin_x * scale)
		// params_margin_y: y轴点相距达到一定的距离，才算两个有效点, 确定线的个数
		let params_margin_y = Math.floor(margin_y * scale)
		// params_dot_margin: 和平均线的偏移量（对缝隙起作用，可去除点，也可变为独立一个点） 太大：被当成另一条直线上，太小：不把它当成一个独立的点
		let params_dot_margin = Math.floor(dot_margin * scale)

		// 去除纵向相邻重复点
		let x_point_arr = []
		let sort_x_point = [...xs].sort((a, b) => a - b)
		for (let i = 0; i < sort_x_point.length - 1; i++) {
			if (sort_x_point[i + 1] - sort_x_point[i] >= params_margin_x)
				x_point_arr.push(sort_x_point[i])
		}
		x_point_arr.push(sort_x_point[sort_x_point.length - 1])

		// 去除横向相邻重复点
		let y_point_arr = []
		let sort_y_point = [...ys].sort((a, b) => a - b)
		for (let i = 0; i < sort_y_point.length - 1; i++) {
			if (sort_y_point[i + 1] - sort_y_point[i] >= params_margin_y)
				y_point_arr.push(sort_y_point[i])
		}
		y_point_arr.push(sort_y_point[sort_y_point.length - 1])

		// 过滤合适交点
		let data_list = []
		for (let i = 0; i < sort_y_point.length; i++) {
			for (let y of y_point_arr) {
				for (let x of x_point_arr) {
					// if (x == 264 && y == 269 && Math.abs(ys[i] - 269) <= params_dot_margin + 5)
					// 	console.log(
					// 		[x, y],
					// 		[xs[i], ys[i]],
					// 		[Math.abs(x - xs[i]) <= params_dot_margin, Math.abs(y - ys[i]) <= params_dot_margin],
					// 	)
					if (Math.abs(y - ys[i]) <= params_dot_margin &&
						Math.abs(x - xs[i]) <= params_dot_margin &&
						!data_list.some(v => v[0] == y && v[1] == x))
						data_list.push([y, x])
				}
			}
		}
		// 分行排列
		let data_dict = {}
		for (let m = 0; m < y_point_arr.length; m++) {
			let line_list = []
			for (let i of data_list) {
				if (i[0] == y_point_arr[m])
					line_list.push(i)
			}
			data_dict[m] = line_list.sort((a, b) => a[1] - b[1])
		}

		return {
			point: {
				col: x_point_arr,
				row: y_point_arr
			},
			data: data_dict
		}
	}
	static getXlineLength(line_xs, line_ys, x, y0, y1) {
		let res = []

		for (let k of [-3, -2, -1, 0, 1, 2, 3])
			for (let i = 0; i < line_xs.length; i++)
				if (line_xs[i] == x + k)
					if (line_ys[i] >= y0 && line_ys[i] <= y1 && !res.some(v => v == line_ys[i]))
						res.push(line_ys[i])

		return res.length
	}
	static getYlineLength(line_xs, line_ys, y, x0, x1) {
		let res = []

		for (let k of [-3, -2, -1, 0, 1, 2, 3])
			for (let i = 0; i < line_ys.length; i++)
				if (line_ys[i] == y + k)
					if (line_xs[i] >= x0 && line_xs[i] <= x1 && !res.some(v => v == line_xs[i]))
						res.push(line_xs[i])

		return res.length
	}
	static getTableReact(src_raw, data, point, line, scale = 1, margin = {
		x0: 2,
		x1: 2,
		y0: 2,
		y1: 2
	}, line_x = 5, line_y = 5) {
		// params_line_x: x上点个数的差值调节（线不均匀，有的粗有的细，甚至有的不连续）
		let params_line_x = Math.floor(line_x * scale)
		// params_line_y: y上点个数的差值调节（线不均匀，有的粗有的细，甚至有的不连续）
		let params_line_y = Math.floor(line_y * scale)

		let x_point_arr = [...point.col]
		let y_point_arr = [...point.row]
		let line_xs = [...line.col]
		let line_ys = [...line.row]
		let image_ranges = []
		for (let i = 0; i < Object.keys(data).length - 1; i++) {
			let data_row = [...data[i]]
			for (let index = 0; index < data_row.length - 1; index++) {
				let val = data_row[index]
				let m = i
				if (index == data_row.length - 1)
					break

				for (let nn = 1; nn < data_row.length - 1; nn++) {
					m = i
					let mark_num = 0
					let n = index + nn
					if (n == data_row.length)
						break

					while (m <= Object.keys(data).length - 2) {
						let mp = data[m + 1].map(v => v[1])
						let x0 = val[1]
						let y0 = val[0]
						let x1 = data_row[n][1]
						let y1 = data[m + 1][0][0]
						let width = x1 - x0
						let height = y1 - y0

						let borderCount = {
							L: ImgUtils.getXlineLength(line_xs, line_ys, x0, y0, y1), // 左
							R: ImgUtils.getXlineLength(line_xs, line_ys, x1, y0, y1), // 右
							U: ImgUtils.getYlineLength(line_xs, line_ys, y0, x0, x1), // 上
							D: ImgUtils.getYlineLength(line_xs, line_ys, y1, x0, x1), // 下
						}

						if (mp.some(v => v == x0) && mp.some(v => v == x1) &&
							Math.abs(borderCount.L - height) <= params_line_y &&
							Math.abs(borderCount.R - height) <= params_line_y &&
							Math.abs(borderCount.U - width) <= params_line_x &&
							Math.abs(borderCount.D - width) <= params_line_x) {
							mark_num = 1

							image_ranges.push({
								range: {
									x0: x0 - margin.x0,
									x1: x1 + margin.x1,
									y0: y0 - margin.y0,
									y1: y1 + margin.y1
								},
								order: {
									x0: x_point_arr.indexOf(x0),
									x1: x_point_arr.indexOf(x1) - 1,
									y0: y_point_arr.indexOf(y0),
									y1: y_point_arr.indexOf(y1) - 1
								},
								roi: src_raw.roi(new cv.Rect(
									x0 - margin.x0,
									y0 - margin.x1,
									width + margin.x0 + margin.x1,
									height + margin.y0 + margin.y1
								))
							})
							break
						} else
							m += 1
					}
					if (mark_num == 1)
						break
				}
			}
		}
		return image_ranges
	}

	static findRects(src, scale = 1) {
		let {
			row,
			col
		} = ImgUtils.parseTableLines(src.binary, scale)
		let mask = ImgUtils.merge(row, col)
		let contours = new cv.MatVector()
		let hierarchy = new cv.Mat()
		cv.findContours(mask, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE)
		// cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

		let filteredContours = new cv.MatVector()
		let rects = []
		for (let i = 0; i < contours.size(); i++) {
			let contour = contours.get(i)

			let area = cv.contourArea(contour)
			let approx = new cv.Mat()
			let approxCount = Math.round(0.02 * cv.arcLength(contour, true))
			cv.approxPolyDP(contour, approx, approxCount, true)
			approx.nj = nj.array([...approx.data32S]).reshape(approx.rows, 2).tolist().sort((a, b) => {
				return Math.abs(a[1] - b[1]) < 3 ? a[0] - b[0] : a[1] - b[1]
			})

			if (area > 100 && ImgUtils.IsApproxReactangle(approx)) {
				filteredContours.push_back(contour)
				let p = {
					x0: approx.nj[0][0],
					y0: approx.nj[0][1],
					x1: approx.nj[3][0],
					y1: approx.nj[3][1]
				}
				rects.push({
					pos: p,
					rect: new cv.Rect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0),
					contour: contour
				})
			}
		}
		// let dst = src.gray.clone()
		// let dst = src.raw.clone()
		// let dst = new cv.Mat.zeros(src.raw.rows, src.raw.cols, cv.CV_8UC3)
		// cv.drawContours(dst, contours, -1, new cv.Scalar(0, 255, 0), 3)
		// cv.drawContours(dst, filteredContours, -1, new cv.Scalar(0, 0, 255), 2)
		// cv.imshow('pdfpreview', dst)

		return {
			contours: filteredContours,
			rects: rects.sort((a, b) => Math.abs(a.pos.y0 - b.pos.y0) < 3 ?
				Math.abs(a.pos.x0 - b.pos.x0) < 3 ?
					0 : a.pos.x0 - b.pos.x0 : a.pos.y0 - b.pos.y0
			)
		}
	}
	static IsApproxReactangle(approx) {
		let count = approx.rows
		let points = [...approx.data32S]
		if (count < 4) {
			// console.log("轮廓不是矩形，顶点数量少于4", approx.nj)
			return false
		}

		if (count > 4) {
			// console.log("轮廓可能不是矩形，顶点数量超过4", approx.nj)
			return false
		}

		const incline = (a, b) => Math.sqrt(a * a + b * b)
		const calcDistance = (p1, p2) => {
			let dx = p2[0] - p1[0]
			let dy = p2[1] - p1[1]
			return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
		}
		const calcAngle = (dot_a, dot_b, dot_c) => {
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
			// console.log("轮廓不是矩形，边的长度差异太大", lens)
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
			// console.log("轮廓不是矩形，夹角差异直角太大", angs)
			return false
		}
		return true
	}
}

const readPDFPage = async (doc, pageNo) => {
	const page = await doc.getPage(pageNo)

	const tokenizedText = await page.getTextContent()
	const pageText = tokenizedText.items
	var {
		canvas,
		viewport,
		scale
	} = await ImgUtils.PDFtoCanvas(page, 1.25)
	return {
		image: {
			element: canvas,
			cv: new ImgUtils(canvas),
			viewport: viewport,
			scale: scale
		},
		pageText: pageText.map((token) => {
			let tr = PDFJS.Util.transform(
				PDFJS.Util.transform(viewport.transform, token.transform),
				[1, 0, 0, -1, 0, 0]
			)
			let [xt, yt] = PDFJS.Util.applyTransform([0, 0], tr)
			let width = token.width / 72 * 2.54 * 10 / scale
			let height = token.height / 72 * 2.54 * 10 / scale
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
		}).sort((a, b) => {
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
	}
}

const readPDFDoc = (file, resolve, reject) => {
	window.api['fs'].readFile(file, async (err, data) => {
		if (err) {
			reject(err)
			return
		}
		let doc = await PDFJS.getDocument({
			data: data,
			cMapUrl: CMAP_URL,
			cMapPacked: CMAP_PACKED
		}).promise
		let pageTextPromises = []
		for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
			pageTextPromises.push(readPDFPage(doc, pageNo))
		}
		let pageTexts = await Promise.all(pageTextPromises)

		// 分割表格区域
		let img = pageTexts[0].image.cv
		let viewport = pageTexts[0].image.viewport
		let scale = pageTexts[0].image.scale
		let {
			row,
			col,
			point,
			line
		} = ImgUtils.parseTableLines(img.binary, 1) //pageTexts[0].image.scale
		// cv.imshow("pdfpreview", img.raw)
		// cv.imshow("pdfpreview", ImgUtils.merge(row, col))
		// cv.imshow("pdfpreview", ImgUtils.bitwise_and(row, col))
		// let p = ImgUtils.bitwise_and(row, col)
		// let pts = new cv.PointVector()
		// p.copyTo(pts)
		// for (let i = 0; i < pts.size(); ++i) {
		// 	let item = pts.get(i); // 获取第 i 个点
		// 	console.log(`Point ${i}: (${item.x}, ${item.y})`); // 输出点的坐标  
		// }
		let texts = [...pageTexts[0].pageText]
		let textRange = []
		let outRange = []

		let range = ImgUtils.parseTableCells(point.col, point.row, scale)
		// let images = ImgUtils.getTableReact(img.raw, range.data, range.point, line, scale)
		// console.log(range, images)
		// texts.forEach((token) => {
		// 	if (!images.some((v, i) => {
		// 			if (v.range.x0 <= token.center.x && v.range.x1 >= token.center.x &&
		// 				v.range.y0 <= token.center.y && v.range.y1 >= token.center.y) {
		// 				textRange[i] = [...(textRange[i] ?? []), token]
		// 				return true
		// 			}
		// 			return false
		// 		}))
		// 		outRange.push(token)
		// })
		// resolve({
		// 	text: outRange,
		// 	images: images.map((v, i) => ({
		// 		src: v.roi,
		// 		text: textRange[i],
		// 		range: v.range
		// 	}))
		// })

		let {
			rects
		} = ImgUtils.findRects(img)
		console.log(rects)
		texts.forEach((token) => {
			if (!rects.map((v, i) => {
				if (v.pos.x0 - 2 <= token.center.x && v.pos.x1 + 2 >= token.center.x &&
					v.pos.y0 - 2 <= token.center.y && v.pos.y1 + 2 >= token.center.y) {
					textRange[i] = [...(textRange[i] ?? []), token]
					return true
				}
				return false
			}).some(v => v))
				outRange.push(token)
		})
		resolve({
			text: outRange,
			images: rects.map((v, i) => ({
				src: img.raw.roi(v.rect),
				text: textRange[i],
				range: v.pos
			}))
		})
	})
}

export default {
	name: 'Home',
	data() {
		console.clear()
		try {
			utools.onPluginEnter(async ({
				code,
				type,
				payload,
				option
			}) => {
				if (type == 'files') {
					for (const item of payload) {
						if (item['isFile']) {
							readPDFDoc(item['path'], (e) => {
								console.log(e)
								let outRangeText = e.text.map(x => x.str).join('').trim()
								let row = {
									path: item['path'],
									oldname: item['name'],
									text: outRangeText,
									newnameComputed: (row) => {
										let reg = new RegExp('发票号码[:：](?<id>[0-9]+)')
										return reg.exec(row.text)?.groups['id']
									},
									_expander: e.images.map((v, i) => {
										let name = `Field_${i}`
										return {
											id: name,
											label: name,
											value: v.text?.map(x => x.str).join('')
										}
									})
								}
								this.tableData.push(row)
								this.tableHead = [{
									id: 'text',
									label: '表外'
								}]
								this.images = e.images.map((v, i) => {
									return {
										render: () => cv.imshow(`prev_${i}`, v.src),
										text: v.text?.map(x => x.str).join('')
									}
								})
							}, (e) => console.log(e))
						}
					}
				}
			})
		} catch (error) {
			console.warn(error)
		}

		return {
			tableHead: [{
				id: 'text',
				label: '全文'
			}],
			// tableData: [{ oldname: '1', newname: '2' }],
			tableData: [],
			exportConfig: {
				fields: {
					旧文件名: 'oldname',
					新文件名: 'newname',
					路径: 'path',
					识别结果: {
						全文: 'text'
					}
				}
			},
			images: []
		}
	},
	watch: {
		tableHead: {
			handler(newval, oldval) {
				this.exportConfig.fields = this.exportDataHeader()
			},
			deep: true
		}
	},
	methods: {
		recognizeText() {
			this.tableHead = [{
				id: 'text',
				label: '全文'
			}]
		},
		recognizeArea() {
			this.tableHead = [{
				id: 'id',
				label: '编码'
			},
			{
				id: 'supply',
				label: '供方'
			},
			{
				id: 'date',
				label: '日期'
			}
			]
		},
		exportDataHeader() {
			var fields = {
				旧文件名: 'oldname',
				新文件名: 'newname',
				路径: 'path'
			}
			this.tableHead.forEach(e => {
				fields[e.label] = e.id
			})
			return fields
		},
		renameFiles() {
			// this.tableData.forEach(e => {
			// 	copyFile(e.oldname, e.newname)
			// })
			this.images.forEach((v, i) => {
				v.render()
			})
		}
	}
}
</script>

<style scoped></style>