import cv from '@techstark/opencv-js'

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
		// cv.imshow('pdfpreview', this.binary)
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
	static reshape(arr: any[], row: number, col: number) {
		let newArr = []
		for (let r = 0; r < row; r++)
			newArr[r] = arr.slice(r * col, (r + 1) * col)
		return newArr
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
			let dataframe: number[][] = ImgUtils.reshape([...approx.data32S], approx.rows, 2)
				.sort((a: number[], b: number[]) => {
					return Math.abs(a[1] - b[1]) < 3 ? a[0] - b[0] : a[1] - b[1]
				})

			if (area > 50 * scale && ImgUtils.IsApproxReactangle(approx)) {
				filteredContours.push_back(contour)
				let p = {
					x0: dataframe[0][0] - 1,
					y0: dataframe[0][1] - 1,
					x1: dataframe[3][0] + 1,
					y1: dataframe[3][1] + 1,
				}
				rects.push({
					pos: p,
					rect: new cv.Rect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0)
				})
			}
			approx.delete()
		}
		rects = rects.sort((a, b) => Math.abs(a.pos.y0 - b.pos.y0) < 3 ?
			Math.abs(a.pos.x0 - b.pos.x0) < 3 ?
				0 : a.pos.x0 - b.pos.x0 : a.pos.y0 - b.pos.y0
		)

		// let dst = new cv.Mat.zeros(src.raw.rows, src.raw.cols, cv.CV_8UC3)
		let dst = src.raw.clone()
		// cv.drawContours(dst, contours, -1, new cv.Scalar(255, 255, 255), 3)
		cv.drawContours(dst, filteredContours, -1, new cv.Scalar(0, 0, 0), 2)

		let srcList = {
			raw: ImgUtils.toDataURL(src.raw),
			// gray: ImgUtils.toDataURL(src.gray),
			// binary: ImgUtils.toDataURL(src.binary),
			// mask: ImgUtils.toDataURL(mask, true),
			contours: ImgUtils.toDataURL(dst, true),
		}

		row_lines.delete()
		col_lines.delete()
		contours.delete()
		hierarchy.delete()
		filteredContours.delete()

		return {
			srcList: srcList,
			rects: rects
		}
	}
	static IsApproxReactangle(approx: cv.Mat) {
		let count = approx.rows
		let points = [...approx.data32S]
		if (count < 4) {
			// console.log("轮廓不是矩形，顶点数量少于4")
			return false
		}

		if (count > 4) {
			// console.log("轮廓可能不是矩形，顶点数量超过4")
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
	static recognizeWordsLine(src: cv.Mat) {
		let arr: number[] = []
		for (let r = 0; r < src.rows; r++) {
			for (let c = 0; c < src.cols; c++) {
				if (src.ptr(r, c) > 0) {
					arr[r] = (arr[r] ?? 0) + 1
				}
			}
		}
		return arr
	}
	static otsuThreshold(pixels: number[]) {
		let sumB = 0
		let wB = 0
		let wF = 0
		let mB, mF
		let max = 0
		let betweenSum = 0
		let threshold = 0
		let count = pixels.length

		// 计算直方图
		const histogram = new Array(Math.max(...pixels)).fill(0)
		for (let i = 0; i < count; i++) {
			histogram[pixels[i]]++
		}

		// 计算总和
		let totalSum = 0
		for (let i = 0; i < histogram.length; i++) {
			totalSum += i * histogram[i]
		}

		// 计算类间方差
		for (let i = 0; i < histogram.length; i++) {
			wB += histogram[i] // 背景像素权重
			if (wB === 0)
				continue
			wF = count - wB // 前景像素权重
			if (wF === 0)
				break
			sumB += i * histogram[i] // 背景像素和
			mB = sumB / wB // 背景像素均值
			mF = (totalSum - sumB) / wF // 前景像素均值
			// 计算类间方差  
			betweenSum = wB * wF * Math.pow(mB - mF, 2)
			// 如果当前类间方差大于之前的最大值，则更新阈值和最大值
			if (betweenSum >= max) {
				max = betweenSum
				threshold = i
			}
		}

		return threshold
	}
}

export { cv, ImgUtils }