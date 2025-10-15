import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon, Cross2Icon, FileTextIcon, SquareIcon, UploadIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { promptRunningType } from "../AgentSection";
import Spinner from "../ui/spinner";


interface MessageInputInterface {
    sendMessage: (message: string, files: { name: string; data: string }[] | undefined) => void;
    promptRunning: promptRunningType;
    currentAgentID: string | undefined;
    stopAgent: () => void;
    isWebSocketOpen: boolean;
    setEditSystemPromptPopup: (value: boolean) => void;
}

interface SelectedFile {
    name: string;
    file: File;
}

export function MessageInput({ sendMessage, promptRunning, currentAgentID, stopAgent, isWebSocketOpen, setEditSystemPromptPopup }: MessageInputInterface) {
    const [prompt, setPrompt] = useState<string>("");
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const sendMessageWrapper = async () => {
        if (prompt === "") return;
        if (selectedFiles.length > 0) {
            const filesData = await Promise.all(selectedFiles.map(file => {
                return new Promise<{ name: string; data: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({ name: file.name, data: reader.result as string });
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file.file);
                });
            }));
            sendMessage(prompt, filesData);
        } else {
            sendMessage(prompt, undefined);
        }
        setPrompt("");
        setSelectedFiles([]);
    }

    useEffect(() => {
        setPrompt("");
        setSelectedFiles([]);
    }, [currentAgentID])

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const newFiles: SelectedFile[] = Array.from(files).map(file => ({
            name: file.name,
            file: file
        }));

        //remove all non pdf files
        const pdfFiles = newFiles.filter(file => file.file.type === 'application/pdf');

        setSelectedFiles(prev => {
            const combined = [...prev, ...pdfFiles];
            return combined.slice(0, 3); // Limit to 3 files
        });

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeFile = (fileName: string) => {
        setSelectedFiles(prev => prev.filter(file => file.name !== fileName));
    };

    const promptButton = () => {
        if (promptRunning === "na" || !isWebSocketOpen) {
            return <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:cursor-not-allowed">
            </div>
        }
        if (promptRunning === "stopped" && isWebSocketOpen) {
            return <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:cursor-pointer hover:bg-slate-700" onClick={sendMessageWrapper}>
                <ArrowUpIcon className="h-5 w-5 stroke-[1.5] text-white" />
            </div>
        }
        if (promptRunning === "running" && isWebSocketOpen) {
            return <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:cursor-pointer hover:bg-slate-700" onClick={stopAgent}>
                <SquareIcon className="h-3 w-3 stroke-[1.5] text-white bg-white" />
            </div>
        }
        if ((promptRunning === "loading")) {
            return <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:cursor-not-allowed">
                <Spinner size="small" className="border-slate-800" />
            </div>
        }
    }

    return (
        <div className="w-full flex flex-col items-start justify-start bg-slate-200 rounded-xl p-4">
            {selectedFiles.length > 0 && (
                <div className="w-full mb-2 flex flex-col gap-2">
                    {selectedFiles.map((file) => (
                        <div key={file.name} className="flex items-center gap-2 bg-slate-300 p-2 rounded-md">
                            <FileTextIcon className="h-4 w-4" />
                            <span className="text-sm truncate flex-1">{file.name}</span>
                            <button
                                onClick={() => removeFile(file.name)}
                                className="hover:bg-slate-100 p-1 rounded-md"
                            >
                                <Cross2Icon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value) }}
                placeholder="Message Radah"
                className='w-full text-md bg-transparent outline-none'
                style={{
                    minHeight: '38px',
                    maxHeight: '200px',
                    height: 'auto',
                    overflow: 'auto',
                    resize: 'none'
                }}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && promptRunning === "stopped" && isWebSocketOpen) {
                        e.preventDefault(); // Prevents creating a new line
                        sendMessageWrapper();
                    }
                }}
            />
            <div className="flex flex-row items-center justify-between w-full">
                <div className="flex flex-row items-end justify-center gap-1">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="application/pdf"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <div
                        className="w-8 h-8 rounded-md flex items-center justify-center hover:cursor-pointer hover:bg-slate-100 relative group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadIcon className="h-5 w-5 text-slate-800" />
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap">
                            Upload PDFs (max 3 files)
                        </div>
                    </div>
                    <div
                        className="w-8 h-8 rounded-md flex items-center justify-center hover:cursor-pointer hover:bg-slate-100 relative group"
                        onClick={() => setEditSystemPromptPopup(true)}
                    >
                        <Pencil1Icon className="h-5 w-5 text-slate-800" />
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap">
                            Change System Prompt
                        </div>
                    </div>
                </div>
                {promptButton()}
            </div>
        </div>
    )
}
