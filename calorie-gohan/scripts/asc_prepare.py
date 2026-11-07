"""App Store Connect の準備を自動で行う。

0. 前回までの自動作業が作った証明書（はんこ）を取り消す（上限で止まらないように）
1. バンドルID（アプリの識別子）が Apple に登録されていなければ登録する
2. App Store Connect にアプリが登録済みか確かめる（未登録なら、やることを表示して止める）

使う鍵は GitHub の Secrets（ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY）と同じもの。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt  # PyJWT

API = "https://api.appstoreconnect.apple.com/v1"
BUNDLE_ID = os.environ.get("BUNDLE_ID", "io.github.kenjicreate.caloriegohan")
BUNDLE_NAME = os.environ.get("BUNDLE_NAME", "Calorie Gohan Cho")


def token():
    with open(os.environ["KEYFILE"]) as f:
        key = f.read()
    now = int(time.time())
    return jwt.encode(
        {"iss": os.environ["ISS"], "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"},
        key,
        algorithm="ES256",
        headers={"kid": os.environ["KID"], "typ": "JWT"},
    )


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"::error::App Store Connect への問い合わせに失敗しました（{e.code}）: {e.read().decode()[:500]}")
        sys.exit(1)


def find_bundle():
    q = urllib.parse.urlencode({"filter[identifier]": BUNDLE_ID, "limit": 200})
    # filter は前方一致なので、完全に同じものだけを選ぶ
    return [b for b in call("GET", "/bundleIds?" + q)["data"] if b["attributes"]["identifier"] == BUNDLE_ID]


def cleanup_certs():
    """自動作業（GitHub の Mac）が作った証明書を取り消す。

    自動作業は毎回まっさらな Mac で動くので、前回作った証明書の鍵は残っておらず、二度と使えない。
    取り消すのは名前に「Created via API」と付くものだけ。人が自分の Mac で作った証明書には触らない。
    App Store・TestFlight に出ているアプリには影響しない。
    """
    certs = call("GET", "/certificates?limit=200")["data"]
    n = 0
    for c in certs:
        a = c["attributes"]
        label = f"{a.get('name') or ''} {a.get('displayName') or ''}"
        if "Created via API" in label:
            call("DELETE", f"/certificates/{c['id']}")
            n += 1
            print(f"  ・取り消し：{a.get('certificateType')} {label.strip()}")
    print(f"自動作業が作った古い証明書を {n} 個取り消しました（全部で {len(certs)} 個あったうち）")


def main():
    cleanup_certs()
    if find_bundle():
        print(f"バンドルID {BUNDLE_ID} は登録済みです")
    else:
        call("POST", "/bundleIds", {"data": {"type": "bundleIds", "attributes": {
            "identifier": BUNDLE_ID, "name": BUNDLE_NAME, "platform": "IOS"}}})
        print(f"バンドルID {BUNDLE_ID} を登録しました")

    q = urllib.parse.urlencode({"filter[bundleId]": BUNDLE_ID})
    if [a for a in call("GET", "/apps?" + q)["data"] if a["attributes"]["bundleId"] == BUNDLE_ID]:
        print("App Store Connect にアプリが登録済みです")
        return
    print(
        "::error::App Store Connect にアプリがまだ登録されていません。"
        "App Store Connect →「アプリ」→「＋」→「新規アプリ」で、"
        f"バンドルID「{BUNDLE_ID}」を選んで登録してから、もう一度動かしてください。"
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
