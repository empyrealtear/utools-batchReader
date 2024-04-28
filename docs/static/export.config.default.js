computedFields = {
    tableHead: () => {
        let companyInfo = (row, offsetrow, matchIndex, matchValue) => {
            let index = row._cells.findIndex(matchIndex)
            let texts = row._cells[index + offsetrow]?.texts
            if (index != -1)
                return Object.entries(texts ?? {})
                    .map(([, v]) => v.map((x) => x.str.trim()).join(''))
                    .find(matchValue)?.replace(/^[^:：]+[:：]/g, '')
        }
        let getAmount = (row) => {
            switch (row.type) {
                case 'pdf': {
                    let match = row._cells.find((v) => /.小写.\s*[¥￥]\s*(\-?[0-9.]+)$|[¥￥]\s*(\-?[0-9.]+)\s*.小写.$/g.test((v.value ?? '').trim()))
                    return parseFloat(match?.value?.replace(/[^-0-9.]+/g, ''))
                }
                case 'ofd': return parseFloat(row._cells.find((v) => v.label == 'TaxInclusiveTotalAmount' && v.value != '¥')?.value)
                default: return NaN
            }
        }

        return [
            {
                id: 'InvoiceCode',
                label: '发票代码',
                align: 'center',
                width: 150,
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': return /发\s*票\s*代\s*码\s*[:：]\s*(?<id>[0-9]+)/g.exec(props.row._text.value)?.groups?.id
                        case 'ofd': return props.row._cells.find((v) => v.label == 'InvoiceCode')?.value
                        default: null
                    }
                }
            },
            {
                id: 'InvoiceNo',
                label: '发票号码',
                align: 'center',
                width: 200,
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': return /发\s*票\s*号\s*码\s*[:：]\s*(?<id>[0-9]+)/g.exec(props.row._text.value)?.groups?.id
                        case 'ofd': return props.row._cells.find((v) => v.label == 'InvoiceNo')?.value
                        default: return null
                    }
                }
            },
            {
                id: 'IssueDate',
                label: '开票日期',
                align: 'center',
                width: 120,
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': return /开\s*票\s*日\s*期\s*[:：]\s*(?<id>\d{4}(\s*年\s*|\s+)\d{1,2}(\s*月\s*|\s+)\d{1,2})/g.exec(props.row._text.value)?.groups?.id?.replace(/[^\d]+/g, '-')
                        case 'ofd': return props.row._cells.find((v) => v.label == 'IssueDate')?.value?.replace(/[^\d]+/g, '-').replace(/-$/g, '')
                        default: return null
                    }
                }
            },
            {
                id: 'TaxInclusiveTotalAmount',
                label: '发票金额',
                align: 'right',
                render: (props) => getAmount(props.row)?.toFixed(2),
                total: (param) => {
                    return (param.data.map((row) => getAmount(row)).reduce((acc, cur) => cur + acc, 0))?.toFixed(2)
                },
            },
            {
                id: 'InvoiceCheckCode',
                label: '校验码',
                align: 'center',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': return /校\s*验\s*码\s*[:：](?<id>[0-9\s]+)/g.exec(props.row._text.value)?.groups?.id?.replace(/\s/g, '')
                        case 'ofd': return props.row._cells.find((v) => v.label == 'InvoiceCheckCode')?.value?.replace(/\s/g, '')
                        default: return null
                    }
                },
            },
            {
                id: 'BuyerName',
                label: '购方名称',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': return companyInfo(props.row, 1, (v) => /^购\n?买.*/g.test(v.value ?? ''), (v) => /名[^:：]+[:：]/g.test(v))
                        case 'ofd': return props.row._cells.find((v) => v.label == 'BuyerName')?.value
                        default: return null
                    }
                },
            },
            {
                id: 'BuyerTaxID',
                label: '购方税号',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': return companyInfo(props.row, 1, (v) => /^购\n?买.*/g.test(v.value ?? ''), (v) => /税[^:：]+[:：]/g.test(v))
                        case 'ofd': return props.row._cells.find((v) => v.label == 'BuyerTaxID')?.value
                        default: return null
                    }
                },
            },
            {
                id: 'BuyerAddrTel',
                label: '购方地址',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': {
                            let index = props.row._cells.findIndex((v) => /^购\n?买.*/g.test(v.value ?? ''))
                            let texts = props.row._cells[index + 1]?.texts
                            if (index != -1) {
                                let ranges = Object.entries(texts ?? {}).map(([, v]) => v.map((x) => x.str.trim()).join(''))
                                let fieldIndex = ranges.findIndex((v) => /地.*址.*[:：]/g.test(v))
                                if (fieldIndex != -1) {
                                    return ranges?.filter((v, i) => i >= 2 && i <= fieldIndex).join('')?.replace(/地.*址.*[:：]/g, '')
                                }
                            }
                            return ''
                        }
                        case 'ofd': return props.row._cells.find((v) => v.label == 'BuyerAddrTel')?.value
                        default: return null
                    }
                },
            },
            {
                id: 'BuyerFinancialAccount',
                label: '购方账号',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': {
                            let index = props.row._cells.findIndex((v) => /^购\n?买.*/g.test(v.value ?? ''))
                            let texts = props.row._cells[index + 1]?.texts
                            if (index != -1) {
                                let ranges = Object.entries(texts ?? {}).map(([, v]) => v.map((x) => x.str.trim()).join(''))
                                let start = ranges.findIndex((v) => /地.*址.*[:：]/g.test(v))
                                let end = ranges.findIndex((v) => /开\s*户\s*行.*[:：]/g.test(v))
                                if (end != -1 && start != -1) {
                                    return ranges?.filter((v, i) => i > start && i <= end).join('')?.replace(/开\s*户\s*行.*[:：]/g, '')
                                }
                            }
                            return ''
                        }
                        case 'ofd': return props.row._cells.find((v) => v.label == 'BuyerFinancialAccount')?.value
                        default: return null
                    }
                },
            },
            {
                id: 'SellerName',
                label: '销方名称',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': return companyInfo(props.row, 1, (v) => /^销\n?售.*/g.test(v.value ?? ''), (v) => /名[^:：]+[:：]/g.test(v))
                        case 'ofd': return props.row._cells.find((v) => v.label == 'SellerName')?.value
                        default: return null
                    }
                },
            },
            {
                id: 'SellerTaxID',
                label: '销方税号',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': return companyInfo(props.row, 1, (v) => /^销\n?售.*/g.test(v.value ?? ''), (v) => /税[^:：]+[:：]/g.test(v))
                        case 'ofd': return props.row._cells.find((v) => v.label == 'SellerTaxID')?.value
                        default: return null
                    }
                },
            },
            {
                id: 'SellerAddrTel',
                label: '销方地址',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': {
                            let index = props.row._cells.findIndex((v) => /^销\n?售.*/g.test(v.value ?? ''))
                            let texts = props.row._cells[index + 1]?.texts
                            if (index != -1) {
                                let ranges = Object.entries(texts ?? {}).map(([, v]) => v.map((x) => x.str.trim()).join(''))
                                let fieldIndex = ranges.findIndex((v) => /地.*址.*[:：]/g.test(v))
                                if (fieldIndex != -1) {
                                    return ranges?.filter((v, i) => i >= 2 && i <= fieldIndex).join('')?.replace(/地.*址.*[:：]/g, '')
                                }
                            }
                            return ''
                        }
                        case 'ofd': return props.row._cells.find((v) => v.label == 'SellerAddrTel')?.value
                        default: return null
                    }
                },
            },
            {
                id: 'SellerFinancialAccount',
                label: '销方账号',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': {
                            let index = props.row._cells.findIndex((v) => /^销\n?售.*/g.test(v.value ?? ''))
                            let texts = props.row._cells[index + 1]?.texts
                            if (index != -1) {
                                let ranges = Object.entries(texts ?? {}).map(([, v]) => v.map((x) => x.str.trim()).join(''))
                                let start = ranges.findIndex((v) => /地.*址.*[:：]/g.test(v))
                                let end = ranges.findIndex((v) => /开\s*户\s*行.*[:：]/g.test(v))
                                if (end != -1 && start != -1) {
                                    return ranges?.filter((v, i) => i > start && i <= end).join('')?.replace(/开\s*户\s*行.*[:：]/g, '')
                                }
                            }
                            return ''
                        }
                        case 'ofd': return props.row._cells.find((v) => v.label == 'SellerFinancialAccount')?.value
                        default: return null
                    }
                },
            },
            {
                id: 'Note',
                label: '备注',
                render: (props) => {
                    switch (props.row.type) {
                        case 'pdf': {
                            let index = props.row._cells.findIndex((v) => /^备\n?注.*/g.test(v.value ?? ''))
                            let texts = props.row._cells[index + 1]?.texts
                            if (index != -1) {
                                return Object.entries(texts ?? {}).map(([, v]) => v.map((x) => x.str.trim()).join('')).join('\n')
                            }
                            return ''
                        }
                        case 'ofd': return props.row._cells.find((v) => v.label == 'Note')?.value
                        default: return null
                    }
                },
            },
        ]
    },
    newName: (props) => {
        let format = '[购方名称]_[销方名称]_[发票代码]-[发票号码]_[开票日期]_[发票金额]'
        this.tableHead.forEach((v) => {
            format = format.replace(`[${v.label}]`, v.render(props) ?? '')
        })
        return format + '.' + props.row.oldname.replace(/.*\./, '')
    },
    tableSort: ({ column, prop, order }) => {
        let collator = new Intl.Collator('zh-Hans-CN', { numeric: true })
        let key = column.rawColumnKey
        let ascend = order == 'ascending' ? 1 : -1
        if (key == 'oldname' || key == 'pageNo') {
            this.tableData = this.tableData.sort((a, b) => {
                if (a.path == b.path)
                    return (a.pageNo - b.pageNo) * ascend
                else
                    return collator.compare(a.oldname, b.oldname) * ascend
            })
        } else {
            let render = key == 'newname' ? this.newName : this.tableHead.find(v => v.id == key)?.render
            this.tableData = this.tableData.sort((a, b) => {
                return collator.compare(render({ row: a }), render({ row: b })) * ascend
            })
        }
    }
}