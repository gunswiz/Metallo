from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
from zipfile import ZipFile
import xml.etree.ElementTree as ET
source = Path(r'C:\Users\welli\Downloads\PARECER_AUDITORIA_INDEPENDENTE_MARCOS_0_1A_1B_20260926.docx')
out = Path(__file__).parent
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
parts=[]
with ZipFile(source) as z:
    for name in z.namelist():
        if name=='word/document.xml' or name in ['word/comments.xml','word/footnotes.xml','word/endnotes.xml']:
            root=ET.fromstring(z.read(name))
            parts.append('PARTE '+name)
            for p in root.findall('.//w:p',ns):
                text=''.join(t.text or '' for t in p.findall('.//w:t',ns))
                if text: parts.append(text)
text='\n'.join(parts)
(out/'parecer-original-extraido.txt').write_text(text,encoding='utf-8')
(out/source.name).write_bytes(source.read_bytes())
print(text)
