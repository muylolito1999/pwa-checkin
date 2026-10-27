"use client";

import { useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addGuestManual, checkDuplicateGuest } from "@/lib/db/mutations";
import { toast } from "sonner";

interface AddGuestDialogProps {
  eventId: string;
}

export function AddGuestDialog({ eventId }: AddGuestDialogProps) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const handleFirstNameChange = async (value: string) => {
    setFirstName(value);
    if (value && lastName) {
      const duplicate = await checkDuplicateGuest(eventId, value, lastName);
      setDuplicateWarning(duplicate);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleLastNameChange = async (value: string) => {
    setLastName(value);
    if (firstName && value) {
      const duplicate = await checkDuplicateGuest(eventId, firstName, value);
      setDuplicateWarning(duplicate);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setLoading(true);
    try {
      await addGuestManual(eventId, firstName.trim(), lastName.trim());
      toast.success(`Added ${firstName} ${lastName}`);
      setFirstName("");
      setLastName("");
      setDuplicateWarning(null);
      setOpen(false);
    } catch (error) {
      toast.error("Failed to add guest");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setFirstName("");
      setLastName("");
      setDuplicateWarning(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Guest
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Guest</DialogTitle>
          <DialogDescription>
            Add a new guest to the list. Only first and last name are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => handleFirstNameChange(e.target.value)}
                placeholder="Mario"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => handleLastNameChange(e.target.value)}
                placeholder="Rossi"
              />
            </div>
            {duplicateWarning && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                <span>{duplicateWarning}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !firstName.trim() || !lastName.trim()}>
              {loading ? "Adding..." : duplicateWarning ? "Add Anyway" : "Add Guest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
