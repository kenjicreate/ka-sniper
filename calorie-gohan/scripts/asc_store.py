"""App Store の掲載情報（文章・スクリーンショット）とビルドを、App Store Connect に自動で入れる。

入れるもの（store/ フォルダの中身）
  - metadata.json：言語ごとのアプリ名・サブタイトル・説明文・キーワード・プライバシーポリシーURL など
  - {言語}/*.png：iPhone 6.9インチ用スクリーンショット（1320×2868、ファイル名の順）。例：ja/、en-US/
  - いちばん新しい処理済みビルドを、提出するバージョンに設定

App Store Connect の画面でしかできないこと（このスクリプトでは触らない）
  - App のプライバシー（集めるデータの申告）、価格、年齢制限、審査用の連絡先、「審査に提出」
"""
import glob
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from asc_prepare import API, BUNDLE_ID, token  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(HERE, "..", "store")
problems = []


def call(method, path, body=None, ok_missing=False):
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(
        url, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:800]
        if ok_missing and e.code == 404:
            return None
        raise RuntimeError(f"{method} {path.split('?')[0]} → {e.code}: {msg}")


def step(title):
    """失敗しても次の作業へ進み、最後にまとめて知らせる"""
    def deco(fn):
        def run(*a):
            try:
                r = fn(*a)
                print(f"✔ {title}")
                return r
            except Exception as e:  # noqa: BLE001
                problems.append(f"{title}：{e}")
                print(f"::warning::{title} に失敗しました：{e}")
        return run
    return deco


def find_app():
    q = urllib.parse.urlencode({"filter[bundleId]": BUNDLE_ID})
    apps = [a for a in call("GET", "/apps?" + q)["data"] if a["attributes"]["bundleId"] == BUNDLE_ID]
    if not apps:
        print("::error::App Store Connect にアプリが登録されていません")
        sys.exit(1)
    return apps[0]["id"]


def editable_app_info(app_id):
    infos = call("GET", f"/apps/{app_id}/appInfos")["data"]
    for i in infos:
        st = i["attributes"].get("appStoreState") or i["attributes"].get("state")
        if st in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "WAITING_FOR_REVIEW", None):
            return i["id"]
    return infos[0]["id"]


def editable_version(app_id):
    q = urllib.parse.urlencode({"filter[platform]": "IOS", "limit": 20})
    for v in call("GET", f"/apps/{app_id}/appStoreVersions?" + q)["data"]:
        if v["attributes"]["appStoreState"] in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"):
            return v["id"]
    raise RuntimeError("編集できるバージョン（提出準備中）が見つかりません")


def localization(list_path, locale, create_type, rel_name, parent_type, parent_id, extra=None):
    for loc in call("GET", list_path)["data"]:
        if loc["attributes"]["locale"] == locale:
            return loc["id"]
    # 新しい言語を足す（アプリ名など、作る時に必ず要る項目は extra で渡す）
    return call("POST", f"/{create_type}", {"data": {"type": create_type, "attributes": dict({"locale": locale}, **(extra or {})),
               "relationships": {rel_name: {"data": {"type": parent_type, "id": parent_id}}}}})["data"]["id"]


def main():
    meta = json.load(open(os.path.join(STORE, "metadata.json"), encoding="utf-8"))
    common = meta["common"]
    app_id = find_app()
    info_id = editable_app_info(app_id)
    version_id = editable_version(app_id)

    @step("カテゴリ")
    def category():
        rel = {"primaryCategory": {"data": {"type": "appCategories", "id": common["primaryCategory"]}}}
        if common.get("secondaryCategory"):
            rel["secondaryCategory"] = {"data": {"type": "appCategories", "id": common["secondaryCategory"]}}
        call("PATCH", f"/appInfos/{info_id}", {"data": {"type": "appInfos", "id": info_id, "relationships": rel}})

    @step("著作権の表示")
    def copyright_():
        call("PATCH", f"/appStoreVersions/{version_id}", {"data": {"type": "appStoreVersions", "id": version_id,
             "attributes": {"copyright": common["copyright"]}}})

    def one_locale(loc, m):
        holder = {}

        @step(f"[{loc}] アプリ名・サブタイトル・プライバシーポリシーURL")
        def app_info_text():
            lid = localization(f"/appInfos/{info_id}/appInfoLocalizations", loc, "appInfoLocalizations", "appInfo", "appInfos", info_id,
                               {"name": m["name"]})
            call("PATCH", f"/appInfoLocalizations/{lid}", {"data": {"type": "appInfoLocalizations", "id": lid, "attributes": {
                "name": m["name"], "subtitle": m["subtitle"], "privacyPolicyUrl": m["privacyPolicyUrl"]}}})

        @step(f"[{loc}] 説明文・キーワード・宣伝文・サポートURL")
        def version_text():
            holder["vl"] = localization(f"/appStoreVersions/{version_id}/appStoreVersionLocalizations", loc,
                                        "appStoreVersionLocalizations", "appStoreVersion", "appStoreVersions", version_id)
            call("PATCH", f"/appStoreVersionLocalizations/{holder['vl']}", {"data": {"type": "appStoreVersionLocalizations",
                 "id": holder["vl"], "attributes": {"description": m["description"], "keywords": m["keywords"],
                 "promotionalText": m["promotionalText"], "supportUrl": m["supportUrl"]}}})

        @step(f"[{loc}] スクリーンショット")
        def screenshots():
            version_loc = holder["vl"]
            files = sorted(glob.glob(os.path.join(STORE, loc, "*.png")))
            if not files:
                raise RuntimeError(f"store/{loc}/ にスクリーンショットがありません")
            kind = "APP_IPHONE_67"  # 6.9インチ（1320×2868）もこの枠
            sets = call("GET", f"/appStoreVersionLocalizations/{version_loc}/appScreenshotSets")["data"]
            sid = next((x["id"] for x in sets if x["attributes"]["screenshotDisplayType"] == kind), None)
            if not sid:
                sid = call("POST", "/appScreenshotSets", {"data": {"type": "appScreenshotSets",
                           "attributes": {"screenshotDisplayType": kind}, "relationships": {"appStoreVersionLocalization":
                           {"data": {"type": "appStoreVersionLocalizations", "id": version_loc}}}}})["data"]["id"]
            # 前に入れたものは消して、入れ直す
            for old in call("GET", f"/appScreenshotSets/{sid}/appScreenshots")["data"]:
                call("DELETE", f"/appScreenshots/{old['id']}")
            for f in files:
                data = open(f, "rb").read()
                shot = call("POST", "/appScreenshots", {"data": {"type": "appScreenshots", "attributes": {
                    "fileName": os.path.basename(f), "fileSize": len(data)}, "relationships": {"appScreenshotSet":
                    {"data": {"type": "appScreenshotSets", "id": sid}}}}})["data"]
                for op in shot["attributes"]["uploadOperations"]:
                    part = data[op["offset"]: op["offset"] + op["length"]]
                    req = urllib.request.Request(op["url"], method=op["method"], data=part,
                                                 headers={h["name"]: h["value"] for h in op["requestHeaders"]})
                    urllib.request.urlopen(req, timeout=120).read()
                call("PATCH", f"/appScreenshots/{shot['id']}", {"data": {"type": "appScreenshots", "id": shot["id"],
                     "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}})
                print(f"  ・{loc}/{os.path.basename(f)}")
            # Apple 側の処理が終わったか確かめる（失敗していたら理由を出す）
            import time
            for _ in range(24):
                shots = call("GET", f"/appScreenshotSets/{sid}/appScreenshots")["data"]
                states = [(x.get("attributes", {}).get("fileName"), (x.get("attributes", {}).get("assetDeliveryState") or {})) for x in shots]
                if all(st.get("state") in ("COMPLETE", "FAILED") for _, st in states):
                    break
                time.sleep(5)
            bad = [f"{n}: {st.get('state')} {st.get('errors')}" for n, st in states if st.get("state") != "COMPLETE"]
            print(f"  → Apple 側の枠 {kind} に {len(states)} 枚。処理済み {len(states) - len(bad)} 枚")
            if bad:
                raise RuntimeError("Apple で処理されなかった画像があります：" + " / ".join(bad))

        app_info_text()
        version_text()
        if holder.get("vl"):
            screenshots()

    @step("提出するビルドの設定（いちばん新しい処理済みのもの）")
    def build():
        q = urllib.parse.urlencode({"filter[app]": app_id, "filter[processingState]": "VALID",
                                    "sort": "-uploadedDate", "limit": 1})
        builds = call("GET", "/builds?" + q)["data"]
        if not builds:
            print("::notice::処理が終わったビルドがまだありません（Apple の処理待ち）。あとでもう一度動かしてください")
            return
        b = builds[0]
        call("PATCH", f"/appStoreVersions/{version_id}/relationships/build", {"data": {"type": "builds", "id": b["id"]}})
        print(f"  ・ビルド {b['attributes']['version']}")

    category()
    copyright_()
    for loc, m in meta["locales"].items():
        one_locale(loc, m)
    build()

    @step("確認：Apple に入っているスクリーンショット")
    def report():
        for loc in meta["locales"]:
            vls = [v for v in call("GET", f"/appStoreVersions/{version_id}/appStoreVersionLocalizations")["data"] if v["attributes"]["locale"] == loc]
            if not vls:
                print(f"  ・{loc}：言語がありません"); continue
            for st in call("GET", f"/appStoreVersionLocalizations/{vls[0]['id']}/appScreenshotSets")["data"]:
                n = len(call("GET", f"/appScreenshotSets/{st['id']}/appScreenshots")["data"])
                print(f"  ・{loc}：{st['attributes']['screenshotDisplayType']} に {n} 枚")
    report()

    if problems:
        print("::error::うまくいかなかった作業があります：\n" + "\n".join(problems))
        sys.exit(1)
    print("掲載情報を入れ終わりました。残りは App Store Connect の画面で："
          "App のプライバシー、価格（無料）、年齢制限、審査用の連絡先、「審査に提出」")


if __name__ == "__main__":
    main()
