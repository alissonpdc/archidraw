# Feature 9: Projetos & Organização

## 9.1 Folders para Agrupar Projetos

**Objetivo:** Organizar múltiplos diagramas em hierarquia.

**Estrutura:**
- Folders simples (nested, sem limite de profundidade)
- Cada pasta pode conter pastas ou projetos
- Persistir em IndexedDB

**Operações:**
- Create folder
- Rename folder
- Delete folder (Can have: confirm if has contents)
- Drag-drop para mover pasta/projeto entre folders

---

## 9.2 Abas Dentro de um Projeto (Multiple Pages)

**Objetivo:** Estruturar um diagrama complexo em múltiplas páginas.

**Behavior:**
- Cada projeto pode ter N abas (como slides do PowerPoint)
- Aba ativa mostra seu canvas próprio
- Trocar aba não perde estado
- Cada aba tem seu próprio set de objetos (independentes)

**Interface:**
- Tab bar no topo do canvas (horizontal tabs)
- + botão para adicionar nova aba
- Right-click para renomear/deletar aba

**Persistência:**
- Todas as abas são salvas no mesmo arquivo (.archidraw)
- Ao reabrir, retorna à última aba ativa (Could Have)

---

## 9.3 Gerenciador de Projetos (Project Manager)

**Objetivo:** Navegar e gerenciar todos os projetos/folders.

**Interface:**
- Vista principal ao abrir app
- Lista com folders e projetos lado-a-lado
- Thumbnails opcionalmente (Could Have)

**Operações:**
- Create novo projeto
- Rename projeto/pasta
- Delete projeto/pasta
- Open projeto (abre em editor)
- Drag-drop para reorganizar/mover

**Feedback:**
- Últimos acessados (Recently opened - Could Have)
- Total projetos (Could Have)
- Tamanho projeto (Could Have)

**Layout sugerido:**
```
Folders | Projects
--------|----------
[Home]  | [Proj A]
[Work]  | [Proj B]
  [API] | [Proj C]
  [DB]  |
```
