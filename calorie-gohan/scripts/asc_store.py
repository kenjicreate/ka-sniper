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

    @step("コンテンツの配信権（他の人の作品は使っていない）")
    def content_rights():
        call("PATCH", f"/apps/{app_id}", {"data": {"type": "apps", "id": app_id, "attributes": {
             "contentRightsDeclaration": common.get("contentRights", "DOES_NOT_USE_THIRD_PARTY_CONTENT")}}})

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

        # 画面の大きさごとの枠：iPhone 6.9インチ（1320×2868）と iPad 13インチ（2048×2732、ファイル名が ipad- で始まるもの）
        all_files = sorted(glob.glob(os.path.join(STORE, loc, "*.png")))
        KINDS = {
            "APP_IPHONE_67": [f for f in all_files if not os.path.basename(f).startswith("ipad-")],
            "APP_IPAD_PRO_3GEN_129": [f for f in all_files if os.path.basename(f).startswith("ipad-")],
        }

        def upload_set(kind, files):
            version_loc = holder["vl"]
            if not files:
                raise RuntimeError(f"store/{loc}/ に {kind} 用のスクリーンショットがありません")
            sets = call("GET", f"/appStoreVersionLocalizations/{version_loc}/appScreenshotSets")["data"]
            sid = next((x["id"] for x in sets if x["attributes"]["screenshotDisplayType"] == kind), None)
            if not sid:
                sid = call("POST", "/appScreenshotSets", {"data": {"type": "appScreenshotSets",
                           "attributes": {"screenshotDisplayType": kind}, "relationships": {"appStoreVersionLocalization":
                           {"data": {"type": "appStoreVersionLocalizations", "id": version_loc}}}}})["data"]["id"]
            # すでに同じ画像が同じ順に入っていれば、何もしない（消して入れ直すと、処理中のあいだ画像が欠けて見えるため）
            existing = call("GET", f"/appScreenshotSets/{sid}/appScreenshots")["data"]
            want = [(os.path.basename(f), hashlib.md5(open(f, "rb").read()).hexdigest()) for f in files]
            have = [(x.get("attributes", {}).get("fileName"), x.get("attributes", {}).get("sourceFileChecksum")) for x in existing]
            # （Apple の処理が終わるまでは checksum が空のことがあるので、その時は名前だけで比べる）
            same = len(want) == len(have) and all(w[0] == h[0] and (h[1] is None or w[1] == h[1]) for w, h in zip(want, have))
            if same:
                print(f"  ・{loc} {kind}：同じスクリーンショットが入っているので、そのまま")
                return
            # 違っていれば、前に入れたものは消して、入れ直す
            for old in existing:
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
            for _ in range(60):  # 最大5分待つ
                shots = call("GET", f"/appScreenshotSets/{sid}/appScreenshots")["data"]
                states = [(x.get("attributes", {}).get("fileName"), (x.get("attributes", {}).get("assetDeliveryState") or {})) for x in shots]
                if all(st.get("state") in ("COMPLETE", "FAILED") for _, st in states):
                    break
                time.sleep(5)
            bad = [f"{n}: {st.get('state')} {st.get('errors')}" for n, st in states if st.get("state") == "FAILED"]
            done = sum(1 for _, st in states if st.get("state") == "COMPLETE")
            print(f"  → Apple 側の枠 {kind} に {len(states)} 枚。処理済み {done} 枚（残りは Apple で処理中）")
            if bad:
                raise RuntimeError("Apple で処理されなかった画像があります：" + " / ".join(bad))

        @step(f"[{loc}] iPhone のスクリーンショット")
        def shots_iphone():
            upload_set("APP_IPHONE_67", KINDS["APP_IPHONE_67"])

        @step(f"[{loc}] iPad のスクリーンショット")
        def shots_ipad():
            upload_set("APP_IPAD_PRO_3GEN_129", KINDS["APP_IPAD_PRO_3GEN_129"])

        app_info_text()
        version_text()
        if holder.get("vl"):
            shots_iphone()
            shots_ipad()

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
    content_rights()
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
                shots = call("GET", f"/appScreenshotSets/{st['id']}/appScreenshots")["data"]
                done = sum(1 for x in shots if (x["attributes"].get("assetDeliveryState") or {}).get("state") == "COMPLETE")
                print(f"  ・{loc}：{st['attributes']['screenshotDisplayType']} に {len(shots)} 枚（処理済み {done} 枚）")
    report()

    if problems:
        print("::error::うまくいかなかった作業があります：\n" + "\n".join(problems))
        sys.exit(1)
    print("掲載情報を入れ終わりました。残りは App Store Connect の画面で："
          "App のプライバシー、価格（無料）、年齢制限、審査用の連絡先、「審査に提出」")


if __name__ == "__main__":
    main()
