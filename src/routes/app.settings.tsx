import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MoreVertical, CreditCard } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Syncletics" }] }),
  component: SettingsPage,
});

const TABS = [
  "My details",
  "Profile",
  "Password",
  "Team",
  "Billings",
  "Plan",
  "Email",
  "Notifications",
];

const HISTORY = [
  {
    invoice: "Account Sale",
    date: "Apr 14, 2004",
    amount: "$3,050",
    status: "Pending",
    tracking: "LM580405575CN",
    address: "313 Main Road, Sunderland",
  },
  {
    invoice: "Account Sale",
    date: "Jun 24, 2008",
    amount: "$1,050",
    status: "Cancelled",
    tracking: "AZ938540353US",
    address: "96 Grange Road, Peterborough",
  },
  {
    invoice: "Netflix Subscription",
    date: "Feb 28, 2004",
    amount: "$800",
    status: "Refund",
    tracking: "3S331605504US",
    address: "2 New Street, Harrogate",
  },
];

const STATUS_STYLES: Record<string, string> = {
  Pending: "border-emerald-500/40 text-emerald-500",
  Cancelled: "border-red-500/40 text-red-500",
  Refund: "border-emerald-500/40 text-emerald-500",
};

function SettingsPage() {
  const { profile, user } = useAuth();
  const [emailChoice, setEmailChoice] = useState("existing");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="Billings" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Billings" className="mt-6 space-y-8">
          {/* Payment Method */}
          <section>
            <h2 className="font-semibold">Payment Method</h2>
            <p className="text-sm text-muted-foreground">
              Update your billing details and address.
            </p>
          </section>

          <Separator />

          {/* Card Details */}
          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-semibold">Card Details</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Update your billing details and address.
              </p>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Add another card
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Name on your Card</Label>
                <Input placeholder="Full name on card" />
              </div>
              <div>
                <Label>Expiry</Label>
                <Input placeholder="MM / YY" />
              </div>
              <div>
                <Label>Card Number</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Card number"
                  />
                </div>
              </div>
              <div>
                <Label>CVV</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="•••"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Contact email */}
          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-semibold">Contact email</h3>
              <p className="text-sm text-muted-foreground">
                Where should invoices be sent?
              </p>
            </div>
            <RadioGroup value={emailChoice} onValueChange={setEmailChoice} className="space-y-3">
              <div className="flex items-start gap-3">
                <RadioGroupItem value="existing" id="email-existing" className="mt-1" />
                <Label htmlFor="email-existing" className="font-normal">
                  <span className="block font-medium">Send to the existing email</span>
                  <span className="text-sm text-muted-foreground">
                    {profile?.email || user?.email || "your@email.com"}
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="another" id="email-another" />
                <Label htmlFor="email-another" className="font-normal">
                  Add another email address
                </Label>
              </div>
              {emailChoice === "another" && (
                <Input placeholder="new@email.com" className="max-w-sm" />
              )}
            </RadioGroup>
          </section>

          <Separator />

          {/* Billing History */}
          <section>
            <h3 className="font-semibold">Billing History</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              See the transaction you made
            </p>
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox />
                    </TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tracking &amp; Address</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {HISTORY.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox />
                      </TableCell>
                      <TableCell className="font-medium">{h.invoice}</TableCell>
                      <TableCell className="text-muted-foreground">{h.date}</TableCell>
                      <TableCell>{h.amount}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[h.status]}>
                          {h.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-primary">{h.tracking}</p>
                        <p className="text-xs text-muted-foreground">{h.address}</p>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </section>
        </TabsContent>

        {TABS.filter((t) => t !== "Billings").map((t) => (
          <TabsContent key={t} value={t} className="mt-6">
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t} settings coming soon.
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
