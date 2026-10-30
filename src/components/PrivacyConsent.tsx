import { useState } from 'react'
import type { Root } from 'react-dom/client'
import { useMessages } from '../i18n'
import { localArea } from '../platform/storage'
import { privacyPolicyText } from '../utils/privacyPolicyText'
import policy from '../../PRIVACY.md?raw'
import { useAppearance } from '../hooks/useAppearance'
import { useSettings } from '../state/settingsStore'
import { Background } from './Background'

const CONSENT_KEY = 'privacyConsent'
const NOTICE_VERSION = 1
const policyText = privacyPolicyText(policy)

function PrivacyConsent({ onAccepted, alreadyAccepted }: { onAccepted: () => void; alreadyAccepted: boolean }) {
  const settings = useSettings()
  useAppearance(settings)
  const t = useMessages().privacyConsent
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [declined, setDeclined] = useState(false)

  const accept = async () => {
    setBusy(true)
    setError(null)
    try {
      // 仅在本机记录同意结果，保存成功后才允许启动书签等功能。
      await localArea.set(CONSENT_KEY, NOTICE_VERSION)
      onAccepted()
    } catch (cause) {
      setError(t.saveFailed(cause instanceof Error ? cause.message : String(cause)))
      setBusy(false)
    }
  }

  return (
    <>
      <Background settings={settings} />
      <main className="bnt-privacy" aria-labelledby="privacy-title">
        <section className="bnt-privacy-card bnt-glass">
          <h1 id="privacy-title">{t.title}</h1>
          <p>{t.intro}</p>
          <ul>
            <li>{t.bookmarks}</li>
            <li>{t.activity}</li>
            <li>{t.sync}</li>
            <li>{t.images}</li>
            <li>{t.network}</li>
          </ul>
          <p>{t.noUpload}</p>
          <details>
            <summary>{t.fullPolicy}</summary>
            <pre>{policyText}</pre>
          </details>
          {declined && <p role="status">{t.declined}</p>}
          {error && <p role="alert">{error}</p>}
          <div className="bnt-privacy-actions">
            {alreadyAccepted ? (
              <button type="button" className="bnt-btn bnt-btn-primary" onClick={onAccepted}>{t.backToNewTab}</button>
            ) : (
              <>
                <button type="button" className="bnt-btn-ghost" disabled={busy} onClick={() => setDeclined(true)}>
                  {t.decline}
                </button>
                <button type="button" className="bnt-btn bnt-btn-primary" disabled={busy} onClick={() => void accept()}>
                  {busy ? t.saving : t.accept}
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </>
  )
}

/** 首次启动及从设置重新查看时，都进入同一个欢迎界面。 */
export async function ensurePrivacyConsent(root: Root, showAgain = false): Promise<void> {
  const alreadyAccepted = await hasPrivacyConsent()
  if (alreadyAccepted && !showAgain) return
  await new Promise<void>((resolve) => {
    root.render(<PrivacyConsent onAccepted={resolve} alreadyAccepted={alreadyAccepted} />)
  })
}

export async function hasPrivacyConsent(): Promise<boolean> {
  return await localArea.get(CONSENT_KEY) === NOTICE_VERSION
}
