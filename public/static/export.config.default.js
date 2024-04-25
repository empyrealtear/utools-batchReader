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
            let match = row._cells.find((v) => /.小写.¥([0-9.]+)$|¥([0-9.]+).小写.$/g.test((v.value ?? '').trim()))
            return parseFloat(match?.value?.replace(/[^-0-9.]+/g, ''))
        }
        
        return [
            {
                id: 'invoiceCode',
                label: '发票代码',
                align: 'center',
                width: 150,
                render: (props) => /发票代码[:：](?<id>[0-9]+)/g.exec(props.row._text.value)?.groups?.id
            },
            {
                id: 'invoiceId',
                label: '发票号码',
                align: 'center',
                width: 200,
                render: (props) => /发票号码[:：](?<id>[0-9]+)/g.exec(props.row._text.value)?.groups?.id
            },
            {
                id: 'invoiceDate',
                label: '开票日期',
                align: 'center',
                width: 120,
                render: (props) => /开票日期[:：](?<id>[0-9]{4}(年|\s+)[0-9]{1,2}(月|\s+)[0-9]{1,2})/g.exec(props.row._text.value)?.groups?.id?.replace(/[^0-9]+/g, '-')
            },
            {
                id: 'amount',
                label: '发票金额',
                align: 'right',
                render: (props) => getAmount(props.row).toFixed(2),
                total: (param) => {
                    return (param.data.map((row) => getAmount(row)).reduce((acc, cur) => cur + acc, 0)).toFixed(2)
                }
            },
            {
                id: 'verifyCode',
                label: '校验码',
                align: 'center',
                render: (props) => /校\s*验\s*码\s*[:：](?<id>[0-9\s]+)/g.exec(props.row._text.value)?.groups?.id?.replace(/\s/g, '')
            },
            {
                id: 'buyer',
                label: '购方名称',
                render: (props) => {
                    return companyInfo(props.row, 1, (v) => /^购\n?买.*/g.test(v.value ?? ''), (v) => /名[^:：]+[:：]/g.test(v))
                },
            },
            {
                id: 'buyerId',
                label: '购方税号',
                render: (props) => {
                    return companyInfo(props.row, 1, (v) => /^购\n?买.*/g.test(v.value ?? ''), (v) => /税[^:：]+[:：]/g.test(v))
                },
            },
            {
                id: 'buyerAddress',
                label: '购方地址',
                render: (props) => {
                    let index = props.row._cells.findIndex((v) => /^购\n?买.*/g.test(v.value ?? ''))
                    let texts = props.row._cells[index + 1]?.texts
                    if (index != -1) {
                        let ranges = Object.entries(texts ?? {}).map(([, v]) => v.map((x) => x.str.trim()).join(''))
                        let fieldIndex = ranges.findIndex((v) => /地.*址.*[:：]/g.test(v))
                        if (fieldIndex != -1) {
                            return ranges?.filter((v, i) => i >= 2 && i <= fieldIndex).join('')?.replace(/地.*址.*[:：]/g, '')
                        }
                    }
                },
            },
            {
                id: 'buyerBank',
                label: '购方账号',
                render: (props) => {
                    return companyInfo(props.row, 1, (v) => /^购\n?买.*/g.test(v.value ?? ''), (v) => /开户行.*[:：]/g.test(v))
                },
            },
            {
                id: 'seller',
                label: '销方名称',
                render: (props) => {
                    return companyInfo(props.row, 1, (v) => /^销\n?售.*/g.test(v.value ?? ''), (v) => /名[^:：]+[:：]/g.test(v))
                },
            },
            {
                id: 'sellerId',
                label: '销方税号',
                render: (props) => {
                    return companyInfo(props.row, 1, (v) => /^销\n?售.*/g.test(v.value ?? ''), (v) => /税[^:：]+[:：]/g.test(v))
                },
            },
            {
                id: 'sellerAddress',
                label: '销方地址',
                render: (props) => {
                    let index = props.row._cells.findIndex((v) => /^销\n?售.*/g.test(v.value ?? ''))
                    let texts = props.row._cells[index + 1]?.texts
                    if (index != -1) {
                        let ranges = Object.entries(texts ?? {}).map(([, v]) => v.map((x) => x.str.trim()).join(''))
                        let fieldIndex = ranges.findIndex((v) => /地.*址.*[:：]/g.test(v))
                        if (fieldIndex != -1) {
                            return ranges?.filter((v, i) => i >= 2 && i <= fieldIndex).join('')?.replace(/地.*址.*[:：]/g, '')
                        }
                    }
                },
            },
            {
                id: 'sellerBank',
                label: '销方账号',
                render: (props) => {
                    let index = props.row._cells.findIndex((v) => /^销\n?售.*/g.test(v.value ?? ''))
                    let texts = props.row._cells[index + 1]?.texts
                    if (index != -1) {
                        let ranges = Object.entries(texts ?? {}).map(([, v]) => v.map((x) => x.str.trim()).join(''))
                        let start = ranges.findIndex((v) => /地.*址.*[:：]/g.test(v))
                        let end = ranges.findIndex((v) => /开户行.*[:：]/g.test(v))
                        if (end != -1 && start != -1) {
                            return ranges?.filter((v, i) => i > start && i <= end).join('')?.replace(/开户行.*[:：]/g, '')
                        }
                    }
                },
            },
        ]
    },
    newName: (prop) => {
        let format = '[购方名称]_[销方名称]_[发票代码]-[发票号码]_[开票日期]_[发票金额]'
        this.tableHead.forEach((v) => {
            format = format.replace(`[${v.label}]`, v?.render(prop) ?? '')
        })
        return format + '.' + prop.row.oldname.replace(/.*\./, '')
    }
}