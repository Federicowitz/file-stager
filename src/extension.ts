import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {

    let copyDisposable = vscode.commands.registerCommand('file-stager.copyFilesToOS', async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
        
        let filePaths: string[] = [];

        // CASO A: Tasto Destro (Context Menu)
        // Qui VS Code ci passa gentilmente i dati
        if (selectedUris && selectedUris.length > 0) {
            filePaths = selectedUris
                .filter(uri => uri.scheme === 'file')
                .map(uri => uri.fsPath);
        }
        else if (clickedUri && clickedUri.scheme === 'file') {
            filePaths = [clickedUri.fsPath];
        }
        
        // CASO B: Tasti Rapidi (Keybinding)
        // Qui VS Code NON ci passa i dati, quindi usiamo il trucco del "Copia Percorso"
        else {
            try {
                // 1. Eseguiamo il comando nativo che copia i path dei file/cartelle selezionati come testo
                await vscode.commands.executeCommand('copyFilePath');
                
                // 2. Leggiamo cosa VS Code ha messo nella clipboard
                const clipboardContent = await vscode.env.clipboard.readText();
                
                // 3. Puliamo il testo (divide per righe se ci sono più file)
                if (clipboardContent) {
                    filePaths = clipboardContent.split(/\r?\n/).filter(line => line.trim() !== '');
                }
            } catch (e) {
                console.error("Errore nel recupero dei percorsi", e);
            }
        }

        // Se non abbiamo trovato nulla, proviamo l'editor attivo come ultima spiaggia
        if (filePaths.length === 0) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.uri.scheme === 'file') {
                filePaths = [activeEditor.document.uri.fsPath];
            }
        }

        // Controllo finale
        if (filePaths.length === 0) {
            vscode.window.setStatusBarMessage("Nessun file o cartella selezionata.", 3000);
            return;
        }

        // --- ESECUZIONE COPIA REALE ---
        try {
            await copyFilesToSystemClipboard(filePaths);
            
            const count = filePaths.length;
            const message = count === 1 
                ? `Copiato: ${filePaths[0]}` 
                : `Copiati ${count} elementi nella clipboard!`;
                
            vscode.window.setStatusBarMessage(message, 3000);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Errore copia clipboard: ${error.message}`);
        }
    });

    context.subscriptions.push(copyDisposable);
}

// --- LOGICA DI SISTEMA (Identica a prima) ---

async function copyFilesToSystemClipboard(paths: string[]): Promise<void> {
    const platform = os.platform();

    if (platform === 'win32') {
        return copyFilesWindows(paths);
    } else if (platform === 'darwin') {
        return copyFilesMac(paths);
    } else {
        throw new Error("Sistema operativo non supportato.");
    }
}

function copyFilesWindows(paths: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const formattedPaths = paths.map(p => `'${p.replace(/'/g, "''")}'`).join(", ");
        const command = `powershell -NoProfile -Command "Set-Clipboard -Path ${formattedPaths}"`;

        cp.exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function copyFilesMac(paths: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const fileList = paths.map(p => `POSIX file "${p}"`).join(", ");
        const script = `tell application "Finder" to set the clipboard to {${fileList}}`;
        const command = `osascript -e '${script}'`;

        cp.exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

export function deactivate() {}