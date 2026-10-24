from pathlib import Path
import pexpect,re
cmd="./node_modules/.bin/bun"
args=["node_modules/@apifuse/provider-sdk/bin/apifuse.ts","init","open-food-facts"]
child=pexpect.spawn(cmd,args,encoding="utf-8",timeout=9)
buf=[]
try:
    def step(pattern,chars):
        child.expect(pattern)
        buf.append(child.before+child.after)
        child.send(chars)
    step(r'Provider name', '\r')
    step(r'Display name', 'Open Food Facts\r')
    step(r'Category', '\x1b[B'*5+'\r')
    step(r'Auth mode', '\r')
    step(r'Runtime', '\r')
    child.expect(pexpect.EOF,timeout=12)
    buf.append(child.before)
except (pexpect.TIMEOUT,pexpect.EOF) as e:
    buf.append(child.before)
    print('scaffold interactivity error',type(e).__name__,flush=True)
finally:
    child.close(force=True)
    output=''.join(buf)
    clean=re.sub(r'\x1b\[[0-9;?]*[a-zA-Z]','',output)
    Path('tools/scaffold.stdout.txt').write_text(clean)
    print('scaffold exit',child.exitstatus,'success',Path('providers/open-food-facts/index.ts').exists())
    print('scaffold trace tail',clean[-2000:].replace('\r','\n'))
