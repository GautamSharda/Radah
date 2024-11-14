import { Button } from "@/components/ui/button";
import { useState } from "react";

interface RenameAgentPopupProps {
    agentName: string;
    onRename: (newName: string) => void;
    setRenameAgentPopup: (show: boolean) => void;
}

export default function RenameAgentPopup({ agentName, onRename, setRenameAgentPopup }: RenameAgentPopupProps) {
    const [newName, setNewName] = useState(agentName);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
                <h2 className="text-xl font-semibold mb-4">Rename Agent</h2>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md mb-4"
                    placeholder="Enter new name"
                />
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => setRenameAgentPopup(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            onRename(newName);
                            setRenameAgentPopup(false);
                        }}
                        disabled={!newName.trim() || newName === agentName}
                    >
                        Rename
                    </Button>
                </div>
            </div>
        </div>
    );
} 