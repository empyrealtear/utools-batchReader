import { cv, ImgUtils } from './ImgUtils.ts'
import * as PDFJS from 'pdfjs-dist'
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/display/api'
PDFJS.GlobalWorkerOptions.workerSrc = 'static/pdfjs/pdf.worker.js'

const sleep = (time: number) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(time)
        }, time)
    })
}


class PDFUtils {
    static CMAP_URL = 'static/pdfjs/cmaps/'
    static CMAP_PACKED = true

    constructor() {
    }

    static groupbyRow(arr: any[], scale = 1) {
        let texts = [...(arr ?? [])]
        if (texts.length == 0)
            return []
        let count = 0
        texts[0].row = count
        for (let i = 1; i < texts.length; i++) {
            let a = texts[i - 1]
            let b = texts[i]
            if (Math.abs(a.center.y - b.center.y) > Math.max(a.height, b.height) * scale) {
                count++
            }
            texts[i].row = count
        }
        let groups = texts.reduce((acc, v) => {
            if (!acc[v.row])
                acc[v.row] = []
            acc[v.row].push(v)
            return acc
        }, [])
        for (let i = 0; i < groups.length; i++) {
            groups[i] = groups[i]?.sort((a: any, b: any) => a.x - b.x)
        }
        return groups
    }

    static async toCanvas(page: PDFPageProxy, scale = 1) {
        let canvas = document.createElement('canvas')
        let context = canvas.getContext('2d')
        let viewport = page.getViewport({
            scale: scale
        })
        canvas.height = viewport.height
        canvas.width = viewport.width

        if (context) {
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise
            //.then((v) => console.log('渲染完毕'))
            // await sleep(400)
        }
        return {
            canvas: canvas,
            viewport: viewport,
            scale: scale
        }
    }

    static async readPDFPage(doc: PDFDocumentProxy, pageNo: number, scale = 1) {
        let page = await doc.getPage(pageNo)
        
        let { canvas, viewport } = await PDFUtils.toCanvas(page, scale)

        // 获取文本内容并排序
        let tokenizedText = await page.getTextContent()
        let pageText = tokenizedText.items.filter((v: any) => v.str.trim().length > 0).map((token: any) => {
            let tr = PDFJS.Util.transform(
                PDFJS.Util.transform(viewport.transform, token.transform),
                [1, 0, 0, -1, 0, 0]
            )
            let [xt, yt] = PDFJS.Util.applyTransform([0, 0], tr)
            let width = token.width / 72 * 2.54 * 10
            let height = token.height / 72 * 2.54 * 10
            return {
                str: token.str.trim(),
                x: Math.round(xt * 10) / 10,
                y: Math.round(yt * 10) / 10,
                width: Math.round(width * 10) / 10,
                height: Math.round(height * 10) / 10,
                center: {
                    x: Math.round((xt + width / 2) * 10) / 10,
                    y: Math.round((yt + height / 2) * 10) / 10
                },
                src: token,
                transform: tr,
            }
        }).sort((a: any, b: any) => {
            let y0_max = Math.max(a.y, b.y)
            let y1_min = Math.min(a.y + a.width, b.y + b.width)
            if (Math.abs(a.center.y - b.center.y) <= Math.min(a.height, b.height)) {
                if ((y1_min - y0_max) / (Math.max(a.width, b.width)) >= 0.5)
                    return a.x - b.x // 按列排序
                else if (Math.abs(a.height - b.height) > Math.min(a.height, b.height))
                    return b.height - a.height // 按字号排序
                else
                    return Math.pow(a.center.y, 2) * Math.pow(a.x, 2) -
                        Math.pow(b.center.y, 2) * Math.pow(b.x, 2) // 按原点距离排序
            }
            return a.y - b.y // 按行排序
        }).filter((v: any, i, arr: any) => {
            if (i == 0)
                return true
            return ['x', 'y', 'str'].some(x => arr[i - 1][x] != v[x])
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


        let cells = rects.map((v, i) => {
            return {
                texts: PDFUtils.groupbyRow(textRange[i], scale),
                src: '',
                // src: ImgUtils.toDataURL(img.raw.roi(v.rect), true),
                range: v.pos
            }
        })
        img.delete()

        return {
            pageNo: pageNo,
            element: { canvas: canvas, scale: scale, srcList: Object.values(srcList) },
            pageText: pageText,
            rangeText: { texts: PDFUtils.groupbyRow(outRange, scale), cells: cells }
        }
    }

    static async readPDFDoc(url: any, resolve: Function) {
        PDFJS.getDocument({
            url: url,
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
    }

    static async mergePDF(...pages: PDFPageProxy[]) {
        return pages
    }

    static async splitPDF(doc: PDFDocumentProxy) {
        return doc
    }
}

export { ImgUtils, PDFUtils, cv, sleep }