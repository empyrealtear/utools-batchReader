import { PDFDocument } from 'pdf-lib'

async function fun(dom: HTMLElement) {
    let doc = await PDFDocument.create()
    dom.offsetWidth
    doc.addPage([width, height])

}
