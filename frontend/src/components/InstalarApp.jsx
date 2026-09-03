import { useState, useEffect } from 'react';

/**
 * Convite para instalar o sistema como app no celular (PWA).
 *
 * Android/Chrome expõe o evento beforeinstallprompt, então dá para instalar
 * com um toque. O iOS não expõe nada: lá só funciona pelo menu Compartilhar
 * do Safari, então mostramos o passo a passo.
 *
 * Não aparece quando já está rodando instalado, nem depois que a pessoa dispensa.
 */

const CHAVE_DISPENSADO = 'pwa_convite_dispensado';

function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function ehInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}
function ehMobile() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export default function InstalarApp({ nomeApp = 'o sistema', cor = '#2563EB', sempreVisivel = false }) {
  const [prompt, setPrompt] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (ehInstalado()) return undefined;
    if (!sempreVisivel && localStorage.getItem(CHAVE_DISPENSADO) === '1') return undefined;
    if (!sempreVisivel && !ehMobile()) return undefined;

    setMostrar(true);
    function capturar(e) {
      e.preventDefault();          // impede o banner nativo, usamos o nosso
      setPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', capturar);
    return () => window.removeEventListener('beforeinstallprompt', capturar);
  }, [sempreVisivel]);

  if (!mostrar) return null;

  async function instalar() {
    if (prompt) {
      prompt.prompt();
      const escolha = await prompt.userChoice;
      if (escolha.outcome === 'accepted') setMostrar(false);
      setPrompt(null);
    } else {
      setAberto(true); // iOS ou navegador sem suporte: mostra o passo a passo
    }
  }

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, '1');
    setMostrar(false);
  }

  const ios = ehIOS();

  return (
    <>
      <div className="pwa-faixa" style={{ borderColor: cor }}>
        <div className="pwa-faixa-txt">
          <strong>Instale {nomeApp} no seu celular</strong>
          <span>Abre em tela cheia, com ícone na sua tela inicial — sem passar pela loja.</span>
        </div>
        <div className="pwa-faixa-acoes">
          <button type="button" className="pwa-btn" style={{ background: cor }} onClick={instalar}>
            {prompt ? 'Instalar' : 'Como instalar'}
          </button>
          <button type="button" className="pwa-x" onClick={dispensar} aria-label="Dispensar">✕</button>
        </div>
      </div>

      {aberto && (
        <div className="pwa-overlay" onClick={() => setAberto(false)}>
          <div className="pwa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-head">
              <strong>Instalar {nomeApp}</strong>
              <button className="pwa-x" onClick={() => setAberto(false)} aria-label="Fechar">✕</button>
            </div>

            <div className="pwa-abas">
              <span className={`pwa-aba ${ios ? 'sel' : ''}`}>iPhone / iPad</span>
              <span className={`pwa-aba ${!ios ? 'sel' : ''}`}>Android</span>
            </div>

            {ios ? (
              <ol className="pwa-passos">
                <li>Abra este site no <strong>Safari</strong> (não funciona pelo Chrome no iPhone).</li>
                <li>Toque no botão <strong>Compartilhar</strong> <span className="pwa-icone">⬆️</span> na barra inferior.</li>
                <li>Role a lista e escolha <strong>Adicionar à Tela de Início</strong>.</li>
                <li>Confirme em <strong>Adicionar</strong>. O ícone aparece junto dos seus apps.</li>
              </ol>
            ) : (
              <ol className="pwa-passos">
                <li>Abra este site no <strong>Chrome</strong>.</li>
                <li>Toque no menu <strong>⋮</strong> no canto superior direito.</li>
                <li>Escolha <strong>Instalar aplicativo</strong> (ou <strong>Adicionar à tela inicial</strong>).</li>
                <li>Confirme em <strong>Instalar</strong>.</li>
              </ol>
            )}

            <p className="pwa-nota">
              Depois de instalado, entre pelo ícone: abre em tela cheia, sem a barra do navegador.
            </p>
          </div>
        </div>
      )}

      <style>{`
        .pwa-faixa{display:flex;align-items:center;gap:12px;justify-content:space-between;
          background:#fff;border:1px solid #e2e5ee;border-left-width:4px;border-radius:12px;
          padding:12px 14px;margin-bottom:14px}
        .pwa-faixa-txt{display:grid;gap:2px;min-width:0}
        .pwa-faixa-txt strong{font-size:14px;color:#1a2b5c}
        .pwa-faixa-txt span{font-size:12.5px;color:#667}
        .pwa-faixa-acoes{display:flex;align-items:center;gap:6px;flex:none}
        .pwa-btn{border:none;color:#fff;border-radius:8px;padding:9px 14px;font:inherit;font-weight:600;font-size:13px;cursor:pointer}
        .pwa-x{background:none;border:none;font-size:15px;color:#8a94a6;cursor:pointer;padding:4px 6px}
        .pwa-overlay{position:fixed;inset:0;background:rgba(15,20,40,.55);display:flex;align-items:center;
          justify-content:center;z-index:1200;padding:16px}
        .pwa-modal{background:#fff;border-radius:14px;width:min(460px,100%);padding:16px;
          box-shadow:0 12px 40px rgba(0,0,0,.3)}
        .pwa-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .pwa-head strong{font-size:16px;color:#1a2b5c}
        .pwa-abas{display:flex;gap:6px;margin-bottom:12px}
        .pwa-aba{font-size:12px;padding:4px 10px;border-radius:999px;background:#eef0f6;color:#8a94a6}
        .pwa-aba.sel{background:#1a2b5c;color:#fff;font-weight:600}
        .pwa-passos{margin:0;padding-left:20px;display:grid;gap:9px;font-size:13.5px;line-height:1.45;color:#334}
        .pwa-icone{font-size:14px}
        .pwa-nota{margin:12px 0 0;font-size:12px;color:#667;background:#f7f8fc;padding:9px 10px;border-radius:8px}
        @media(max-width:520px){
          .pwa-faixa{flex-direction:column;align-items:stretch}
          .pwa-faixa-acoes{justify-content:space-between}
        }
      `}</style>
    </>
  );
}
