# 🌟 Lumina Notes

> Aplicativo desktop de anotações, diário, lembretes e calendário.  
> Construído com Electron + SQLite. 100% offline.

---

## ✨ Funcionalidades

- **📝 Anotações** — Linha do tempo, fixar, favoritar, tags, cores, anexos
- **📖 Diário** — Entradas com humor (emoji), linha do tempo cronológica
- **🔔 Lembretes** — Notificações nativas do Windows, vinculáveis a notas
- **📅 Calendário** — Visualização mensal com eventos coloridos
- **📎 Anexos** — Fotos, vídeos, documentos, qualquer arquivo
- **🎨 Temas** — Escuro, Claro, Meia-noite, Sépia + 7 cores de destaque
- **👤 Multi-usuário** — Login local, múltiplas contas no mesmo PC
- **💾 Export/Import** — Arquivo `.lmn` para backup e transferência entre PCs

---

## 🚀 Instalação e Desenvolvimento

### Pré-requisitos
- **Node.js** 18+ → https://nodejs.org
- **npm** (incluso com Node.js)

### 1. Instalar dependências
```bash
cd lumina-app
npm install
```

### 2. Gerar ícones (opcional)
```bash
node scripts/generate-icons.js
```

### 3. Rodar em modo desenvolvimento
```bash
npm start
```

---

## 🏗️ Build para Windows (.exe instalável)

### Build completo
```bash
npm run build:win
```

O instalador será gerado em `dist/Lumina Notes Setup 1.0.0.exe`

### O que o instalador faz:
- ✅ Instala o app no Windows
- ✅ Cria atalho na área de trabalho
- ✅ Cria atalho no menu iniciar
- ✅ Permite escolher pasta de instalação
- ✅ Inclui desinstalador

---

## 📁 Estrutura do Projeto

```
lumina-app/
├── src/
│   ├── main/
│   │   ├── main.js          # Processo principal do Electron
│   │   ├── database.js      # SQLite - toda a persistência
│   │   ├── reminders.js     # Agendamento de lembretes
│   │   └── preload.js       # Bridge main ↔ renderer (seguro)
│   └── renderer/
│       ├── index.html       # UI principal
│       ├── reminder.html    # Janela flutuante de lembrete
│       ├── styles/
│       │   └── main.css     # Design system completo
│       ├── js/
│       │   └── app.js       # Toda a lógica do frontend
│       └── assets/
│           ├── icon.svg     # Ícone vetorial
│           ├── icon.png     # Ícone PNG
│           └── icon.ico     # Ícone Windows
├── scripts/
│   └── generate-icons.js   # Gerador de ícones
├── dist/                   # Build output (gerado pelo electron-builder)
└── package.json
```

---

## 💾 Dados do Usuário

Os dados são salvos automaticamente em:
- **Windows**: `%APPDATA%\lumina-notes\`
  - `lumina.db` — Banco SQLite com notas, lembretes, etc.
  - `files\` — Arquivos anexados

### Transferir para outro PC
1. No app: **Configurações → Dados → Exportar dados (.lmn)**
2. Copie o arquivo `.lmn` para o outro PC
3. No outro PC: **Configurações → Dados → Importar dados (.lmn)**

---

## 🎨 Temas disponíveis
| Tema | Descrição |
|------|-----------|
| Escuro | Dark mode padrão |
| Claro | Light mode |
| Meia-noite | Ultra dark |
| Sépia | Tom quente marrom |

---

## ⌨️ Atalhos

| Atalho | Ação |
|--------|------|
| `Ctrl+S` | Salvar nota |
| `Esc` | Fechar modal/popup |

---

## 🛠️ Tech Stack

- **Electron 28** — Framework desktop
- **better-sqlite3** — Banco de dados local
- **bcryptjs** — Hash de senhas
- **archiver + extract-zip** — Export/Import
- **DM Sans + Instrument Serif** — Tipografia
- **CSS puro** — Design system (sem frameworks CSS)

---

## 📋 Solução de problemas

### `better-sqlite3` falha no build
```bash
npm rebuild better-sqlite3
```

### Erro de permissão no Windows
Execute o terminal como **Administrador** antes de rodar `npm install`.

### O ícone não aparece
```bash
node scripts/generate-icons.js
```
