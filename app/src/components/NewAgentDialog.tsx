import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface NewAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agentType: 'J.I.M' | 'P.A.M') => void;
}

const NewAgentDialog: React.FC<NewAgentDialogProps> = ({ isOpen, onClose, onSelectAgent }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Agent Type</DialogTitle>
          <DialogDescription>
            Choose the type of agent you want to add.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center space-x-4 my-4">
          <Button onClick={() => onSelectAgent('J.I.M')}>
            J.I.M (Jobs and Internship Matchmaker)
          </Button>
          <Button onClick={() => onSelectAgent('P.A.M')}>
            P.A.M (Performs Anything Machine)
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewAgentDialog;
