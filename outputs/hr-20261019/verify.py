import zipfile, xml.etree.ElementTree as E, json, datetime
from pathlib import Path
p=Path(__file__).parent
d=json.loads((p/'source.json').read_text(encoding='utf8'))
z=zipfile.ZipFile(p/'Danh_sach_nhan_su_01-07_den_19-10-2026.xlsx')
n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sh=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
rows=[r for r in sh.findall('s:sheetData/s:row',n) if int(r.attrib['r'])>=8]
active=inactive=0
for r,u in zip(rows,d['users']):
    cells={c.attrib['r'].rstrip('0123456789'):c for c in r.findall('s:c',n)}
    def value(k): return cells[k].find('s:v',n).text
    assert value('B')==u['phone'] and cells['B'].attrib['t']=='str'
    assert cells['D'].attrib['t']=='d'
    actual=datetime.datetime.fromisoformat(value('D').replace('Z','+00:00'))
    expected=datetime.datetime.fromisoformat(u['createdAt'].replace('Z','+00:00'))+datetime.timedelta(hours=7)
    assert abs((actual-expected).total_seconds())<0.002, (r.attrib['r'],actual,expected)
    assert value('C')==('Đang làm việc' if u['isActive'] else 'Đã nghỉ việc')
    active+=u['isActive']; inactive+=not u['isActive']
assert len(rows)==55 and active==37 and inactive==18
assert not any(c.attrib.get('t')=='e' for c in sh.findall('.//s:c',n))
assert z.testzip() is None
print({'verified_rows':len(rows),'active':active,'inactive':inactive,'phone_leading_zeros':'preserved as text','dates':'typed dates, UTC+7 verified','xlsx_integrity':'OK'})
