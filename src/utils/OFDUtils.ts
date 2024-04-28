import JSZIP from 'jszip'
import * as jq from 'jquery'
import * as htmlToImage from 'html-to-image'

// 需要index.html引入ofd.umd.js
const ofdjs = window.ofd

class OFDUtils {
	arraybuffer: ArrayBuffer
	raw: Promise<JSZIP>
	ofd: Element
	docInfo: {}
	tags: {}
	pages: {}[]

	constructor(arraybuffer: ArrayBuffer) {
		this.arraybuffer = arraybuffer
		let zip = new JSZIP()
		this.raw = zip.loadAsync(arraybuffer)
		this.docInfo = {}
		this.tags = {}
		this.pages = []
	}

	then(resolve: any = (v: OFDUtils) => v) {
		const loadxml = async () => {
			this.ofd = await this.parseXml('OFD.xml')
			this.docInfo = this.parseDocInfo(this.ofd)

			let docRoot = this.ofd.getElementsByTagName('ofd:DocRoot')[0]?.textContent

			if (docRoot) {
				let rootDir = docRoot.replace(/[^\/]+$/g, '')
				let pages, tags
				let root = await this.parseXml(docRoot)

				let tags_path = root.getElementsByTagName('ofd:CustomTags')[0]?.textContent
				if (tags_path) {
					let tags_xml = await this.parseXml(rootDir + tags_path)
					let tags_dir = rootDir + tags_path?.replace(/[^\/]+$/g, '')
					tags = Object.entries(tags_xml.getElementsByTagName('ofd:CustomTag')).map(([, v]) => tags_dir + v.textContent)
					this.tags = await this.parseTags(tags)
				}

				pages = Object.entries(root.getElementsByTagName('ofd:Pages')[0].children)
					.map(([, v]) => rootDir + v.getAttribute('BaseLoc'))
				this.pages = await this.parsePages(pages)
				
			}
			ofdjs.parseOfdDocument({
				ofd: this.arraybuffer,
				success: async (res: any) => {
					let screenWidth = 21.5 / 2.54 * 72 *2
					let ofdRenderRes = ofdjs.renderOfdByScale(res[0])
					var div = document.getElementById('preview-cache')
					for (let i = 0; i < ofdRenderRes.length; i++) {
						div.innerHTML = ''
						div.appendChild(ofdRenderRes[i])
						let styles = ofdRenderRes[i].getAttribute('style').split(';')
						let width = parseFloat(styles.find(v => /^width/.test(v)).replace(/[^\d]/g, ''))
						let height = parseFloat(styles.find(v => /^height/.test(v)).replace(/[^\d]/g, ''))
						let scale = screenWidth / width
						await htmlToImage.toCanvas(ofdRenderRes[i], { canvasWidth: screenWidth, canvasHeight: height * scale })
							.then((canvas) => {
								this.pages[i].element = {
									canvas: canvas,
									scale: scale,
									srcList: [canvas.toDataURL()]
								}
							}).finally(() => {
								div.innerHTML = ''
							})
					}
					resolve(this)
				},
				fail: (error: any) => {
					console.log(error)
				}
			})
		}
		loadxml()
	}

	async parseXml(path: string) {
		let xml: Element
		await this.raw.then(async (zip) => {
			await zip.files[path].async('string').then((str) => {
				// 兼容税务UKey版式发票
				str = str
					.replaceAll('<:', '<ofd:')
					.replaceAll('</:', '</ofd:')
					.replace('xmlns:=""', 'xmlns:ofd="http://www.ofdspec.org/2016"')
				xml = jq.parseXML(str)
			})
		})
		return xml
	}

	parseDocInfo(ofd: Element) {
		return Object.entries(ofd.getElementsByTagName('ofd:DocInfo')[0].children).reduce((prev: any, [, v]) => {
			if (v.children.length > 0) {
				// customdatas
				prev[v.localName] = Object.entries(v.children).reduce((dic: any, [, v]) => {
					let name = v.getAttribute('Name') ?? v.localName
					dic[name] = v.textContent
					return dic
				}, {})
			} else {
				// fields
				prev[v.localName] = v.textContent
			}
			return prev
		}, {})
	}

	async parseTags(tags: string[]) {
		let res: any = {}
		for (let v of tags) {
			let xml = await this.parseXml(v)
			Object.entries(xml.getElementsByTagName('ofd:ObjectRef')).map(([, v]) => {
				if (v.parentElement && v.textContent)
					res[v.textContent] = v.parentElement.localName
			})
		}
		return res
	}

	async parsePages(pages: string[], scale) {
		let arr: any[] = []
		for (let i = 0; i < pages.length; i++) {
			let xml = await this.parseXml(pages[i])
			arr[i] = {
				texts: Object.entries(xml.getElementsByTagName('ofd:TextCode')).map(([, v]) => {
					let id = v.parentElement?.getAttribute('ID')
					return {
						id: id,
						name: this.tags[id],
						value: v.textContent
					}
				}),
				element: {}
			}
		}
		return arr
	}
}

export { jq, ofdjs, OFDUtils }