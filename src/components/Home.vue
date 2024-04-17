<template>
    <div>
        <el-table :data="tableData" height="455px" max-height="455px" min-width="720px" stripe show-overflow-tooltip
            highlight-current-row :header-cell-style="{ 'text-align': 'center' }">
            <el-table-column prop="oldname" label="旧文件名" width="120px" sortable />
            <el-table-column prop="newname" label="新文件名" width="120px" sortable />
            <el-table-column prop="path" label="路径" width="120px" sortable />
            <el-table-column label="识别结果" show-overflow-tooltip>
                <el-table-column v-for="(item, index) in tableHead" :key="index" :prop="item.id" :label="item.label"
                    width="120px" />
            </el-table-column>
        </el-table>
        <div>
            <view hidden>
                <canvas id="pdfpreview"></canvas>
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
import Tesseract from 'tesseract.js'
import * as PDFJS from 'pdfjs-dist/build/pdf.js'
PDFJS.GlobalWorkerOptions.workerSrc = 'static/pdfjs/pdf.worker.js'
// import * as cv from 'opencv4js'

// console.log(cv)
const CMAP_URL = 'static/pdfjs/cmaps/'
const CMAP_PACKED = true

function copyFile(oldpath, newpath) {
    const fs = window.api.fs
    const rs = fs.createReadStream(oldpath)
    const ws = fs.createWriteStream(newpath)

    rs.on('data', chunk => {
        ws.write(chunk)
    })
}

const readPDFPage = async (doc, pageNo) => {
    const page = await doc.getPage(pageNo)

    const tokenizedText = await page.getTextContent()
    const pageText = tokenizedText.items

    var canvas = document.getElementById('pdfpreview')
    var ctx = canvas.getContext('2d')
    var viewport = page.getViewport({ scale: 1 })
    canvas.height = viewport.height
    canvas.width = viewport.width
    var success = await page.render({
        canvasContext: ctx,
        viewport: viewport
    }).promise
    var img = canvas.toDataURL("image/jpeg", 1)
    return {
        image: img,
        pageText: pageText
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
        pageTexts[0].pageText = pageTexts[0].pageText.filter(token => token.str.trim().length > 0).map(token => {
            return {
                ...token,
                x: token.transform[4],
                xcenter: Math.round((token.transform[4] + (token.width / 2)) * 100) / 100,
                y: token.transform[5],
                ycenter: Math.round((token.transform[5] + (token.height / 2)) * 100) / 100
            }
        }).sort((a, b) => {
            if (Math.abs(a.ycenter - b.ycenter) <= Math.min(a.height, b.height)) {
                return a.x - b.x
            } else {
                return b.y - a.y
            }
        })
        console.log(pageTexts[0])
        resolve(pageTexts.map(v => v.pageText.map(x => x.str).join('\n')).join(''))
    })
}

export default {
    name: 'Home',
    data() {
        
        try {
            utools.onPluginEnter(async ({ code, type, payload, option }) => {
                if (type == 'files') {
                    for (const item of payload) {
                        if (item['isFile']) {
                            // (async () => {
                            //     this.tableData.push({
                            //         path: item['path'],
                            //         oldname: item['name']
                            //     })
                            // })()
                            readPDFDoc(item['path'], (e) => {
                                var file = {
                                    path: item['path'],
                                    oldname: item['name'],
                                    text: e
                                }
                                this.tableData.push(file)
                            }, (e) => console.log(e))
                        }
                    }
                }
                console.log(this.tableData)
            })
        } catch (error) {
            console.warn(error)
        }

        return {
            tableHead: [{ id: 'text', label: '全文' }],
            // tableData: [{ oldname: '1', newname: '2' }],
            tableData: [],
            exportConfig: {
                fields: {
                    旧文件名: 'oldname',
                    新文件名: 'newname',
                    路径: 'path',
                    识别结果: { 全文: 'text' }
                }
            }
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
            this.tableHead = [
                { id: 'text', label: '全文' }
            ]
        },
        recognizeArea() {
            this.tableHead = [
                { id: 'id', label: '编码' },
                { id: 'supply', label: '供方' },
                { id: 'date', label: '日期' }
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
            this.tableData.forEach(e => {
                copyFile(e.oldname, e.newname)
            })
        }
    }
}
</script>

<style scoped></style>