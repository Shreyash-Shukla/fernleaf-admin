'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatCents, formatDate, formatMinutesToTime, minutesToTimeString, timeStringToMinutes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface SelectedCombination {
  quantity: number;
  options: {
    groupName: string;
    optionName: string;
    portionName?: string | null;
  }[];
}

interface OrderLineDraft {
  dishId: string;
  dishName: string;
  dishSku: string;
  dishPriceCents: number;
  minOrderQty?: number;
  quantity: number;
  combinations: SelectedCombination[];
}

export default function NewOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Current Step: 1 = Employee & Date, 2 = Menu & Selection, 3 = Combinations, 4 = Delivery Details, 5 = Review & Submit
  const [step, setStep] = useState(1);

  // Form State
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTimeMin, setDeliveryTimeMin] = useState(720); // 12:00 PM
  const [addressId, setAddressId] = useState('');
  const [packaging, setPackaging] = useState('STANDARD');
  const [orderNotes, setOrderNotes] = useState('');
  const [allergenAcknowledged, setAllergenAcknowledged] = useState(false);

  // Selected Order Lines
  const [orderLines, setOrderLines] = useState<OrderLineDraft[]>([]);

  // 1. Fetch Companies
  const { data: companiesData } = useQuery<{ items: any[] }>({
    queryKey: ['companies', 'for-order'],
    queryFn: () => fetchApi('/companies?limit=100&active=true'),
  });

  // 2. Fetch Selected Company Detail (addresses, calendar, defaults)
  const { data: companyDetail } = useQuery<any>({
    queryKey: ['company', selectedCompanyId],
    queryFn: () => fetchApi(`/companies/${selectedCompanyId}`),
    enabled: !!selectedCompanyId,
  });

  // 3. Fetch Employees for selected company
  const { data: employeesData } = useQuery<{ items: any[] }>({
    queryKey: ['employees', 'company', selectedCompanyId],
    queryFn: () => fetchApi(`/employees?companyId=${selectedCompanyId}&limit=100&active=true`),
    enabled: !!selectedCompanyId,
  });

  // 4. Fetch Selected Employee Detail
  const { data: employeeDetail } = useQuery<any>({
    queryKey: ['employee', selectedEmployeeId],
    queryFn: () => fetchApi(`/employees/${selectedEmployeeId}`),
    enabled: !!selectedEmployeeId,
  });

  // 5. Fetch Resolved Menu for Selected Employee
  const { data: menuData, isLoading: menuLoading } = useQuery<any>({
    queryKey: ['menu', 'preview', selectedEmployeeId],
    queryFn: () => fetchApi(`/menu/preview?employeeId=${selectedEmployeeId}`),
    enabled: !!selectedEmployeeId && step >= 2,
  });

  // 6. Meta for today
  const { data: meta } = useQuery<any>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  // Set default date when meta arrives
  useEffect(() => {
    if (meta?.today && !deliveryDate) {
      const d = new Date(meta.today);
      d.setDate(d.getDate() + 1); // default to tomorrow
      setDeliveryDate(d.toISOString().slice(0, 10));
    }
  }, [meta, deliveryDate]);

  // Set defaults when company changes
  useEffect(() => {
    if (companyDetail) {
      if (companyDetail.defaultDeliveryTimeMin !== undefined) {
        setDeliveryTimeMin(companyDetail.defaultDeliveryTimeMin);
      }
      if (companyDetail.defaultPackaging) {
        setPackaging(companyDetail.defaultPackaging);
      }
      const defaultAddr = companyDetail.addresses?.find((a: any) => a.isDefault) || companyDetail.addresses?.[0];
      if (defaultAddr) {
        setAddressId(defaultAddr.id);
      }
    }
  }, [companyDetail]);

  // 7. Preview Mutation
  const previewMutation = useMutation({
    mutationFn: (payload: any) => fetchApi('/orders/preview', { method: 'POST', body: JSON.stringify(payload) }),
  });

  // Run preview when entering Step 5
  useEffect(() => {
    if (step === 5 && selectedEmployeeId && deliveryDate && addressId) {
      const payload = {
        employeeId: selectedEmployeeId,
        deliveryDate,
        deliveryTimeMin,
        addressId,
        packaging,
        lines: orderLines.map((line) => ({
          dishId: line.dishId,
          quantity: line.quantity,
          combinations: line.combinations,
        })),
        notes: orderNotes,
        allergenAcknowledged,
      };
      previewMutation.mutate(payload);
    }
  }, [step, selectedEmployeeId, deliveryDate, deliveryTimeMin, addressId, packaging, orderLines, allergenAcknowledged, orderNotes]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateOrder(shouldPlace: boolean) {
    if (!selectedEmployeeId || !deliveryDate || !addressId) {
      toast.error('Please complete all delivery requirements');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: selectedEmployeeId,
        deliveryDate,
        deliveryTimeMin,
        addressId,
        packaging,
        lines: orderLines.map((line) => ({
          dishId: line.dishId,
          quantity: line.quantity,
          combinations: line.combinations,
        })),
        notes: orderNotes,
        allergenAcknowledged,
      };

      // 1. Create Draft
      const draftRes = await fetchApi('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const orderId = draftRes.order?.id || draftRes.id;

      if (shouldPlace) {
        // 2. Transition to PLACED
        await fetchApi(`/orders/${orderId}/place`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Order #${draftRes.order.number} placed successfully`);
      } else {
        toast.success(`Draft order #${draftRes.order.number} saved`);
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.push(`/orders/${orderId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  }

  // Dish adding helper
  function addDishToOrder(dish: any) {
    const existingIndex = orderLines.findIndex((l) => l.dishId === dish.id);
    const minQty = dish.minOrderQty || 1;

    if (existingIndex >= 0) {
      toast.info(`${dish.name} is already added. Adjust quantity in Step 3.`);
      return;
    }

    // Generate initial combination satisfying required groups
    const initialComboOptions: any[] = [];
    if (dish.optionGroups) {
      dish.optionGroups.forEach((group: any) => {
        if (group.required && group.options?.length > 0) {
          const firstOpt = group.options[0];
          initialComboOptions.push({
            groupName: group.name,
            optionName: firstOpt.name,
            portionName: group.usesPortions && group.portions?.length > 0 ? group.portions[0].portionSize.name : null,
          });
        }
      });
    }

    const newLine: OrderLineDraft = {
      dishId: dish.id,
      dishName: dish.name,
      dishSku: dish.sku,
      dishPriceCents: dish.priceCents,
      minOrderQty: dish.minOrderQty,
      quantity: minQty,
      combinations: [
        {
          quantity: minQty,
          options: initialComboOptions,
        },
      ],
    };

    setOrderLines([...orderLines, newLine]);
    toast.success(`Added ${dish.name} to order`);
  }

  return (
    <AppShell requiredPermission="orders:write">
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title="Create Order"
          subtitle="Order Builder: configure dish combinations, enforce employee rules, and live validate"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/orders')}
            >
              Cancel & return
            </Button>
          }
        />

        {/* Stepper Header */}
        <div className="flex items-center justify-between bg-surface p-2.5 rounded-lg border border-border text-xs">
          {[
            { num: 1, label: 'Employee & date' },
            { num: 2, label: 'Select menu' },
            { num: 3, label: 'Combinations' },
            { num: 4, label: 'Delivery' },
            { num: 5, label: 'Review & place' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => {
                if (s.num < step) setStep(s.num);
              }}
              disabled={s.num > step}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                step === s.num
                  ? 'bg-brand-soft text-brand-text font-medium border border-brand-solid'
                  : step > s.num
                  ? 'text-text hover:bg-raised cursor-pointer'
                  : 'text-faint cursor-not-allowed'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums ${
                  step === s.num
                    ? 'bg-brand-solid text-[#042F2E]'
                    : step > s.num
                    ? 'bg-raised text-text border border-border'
                    : 'bg-raised text-faint'
                }`}
              >
                {step > s.num ? <Check className="w-3 h-3" /> : s.num}
              </span>
              <span className="hidden md:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* STEP 1: Employee & Delivery Date */}
        {step === 1 && (
          <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
            <div>
              <div className="font-semibold text-sm text-text">Step 1: Choose employee & delivery date</div>
              <p className="text-xs text-muted mt-0.5">
                Select target company and employee to resolve their designated price tier and permissions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-medium text-text block mb-1">
                  Company *
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedEmployeeId('');
                    setOrderLines([]);
                  }}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                >
                  <option value="">Select a company…</option>
                  {extractList(companiesData).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-text block mb-1">
                  Employee *
                </label>
                <select
                  value={selectedEmployeeId}
                  disabled={!selectedCompanyId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    setOrderLines([]);
                  }}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid disabled:opacity-40"
                >
                  <option value="">
                    {selectedCompanyId ? 'Select employee…' : 'Select company first'}
                  </option>
                  {extractList(employeesData).map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-text block mb-1">
                  Delivery date *
                </label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
                <p className="text-[11px] text-muted mt-1">
                  Must be a kitchen & company working day and not a kitchen holiday.
                </p>
              </div>
            </div>

            {/* Employee Profile Preview */}
            {employeeDetail && (
              <div className="p-4 rounded-lg bg-app border border-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-text">
                    <span>{employeeDetail.name}</span>
                    <span className="text-muted font-normal">({employeeDetail.email})</span>
                  </div>
                  <Chip>Tier: {companyDetail?.tier?.name || 'Default Tier'}</Chip>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {employeeDetail.allergens?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded text-[11px]">
                      <AlertTriangle className="w-3 h-3 text-danger" />
                      Allergies: {employeeDetail.allergens.map((a: any) => a.allergen.name).join(', ')}
                    </div>
                  )}
                  {employeeDetail.dietaryTags?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-text bg-raised border border-border px-2 py-0.5 rounded text-[11px]">
                      Preferences: {employeeDetail.dietaryTags.map((t: any) => t.tag.name).join(', ')}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-muted pt-1 flex gap-4">
                  <span>Address customization: {employeeDetail.canChooseAddress ? 'Allowed' : 'Locked to default'}</span>
                  <span>Time change: {employeeDetail.canChangeTime ? 'Allowed' : 'Locked to company default'}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-border">
              <Button
                disabled={!selectedEmployeeId || !deliveryDate}
                onClick={() => setStep(2)}
              >
                Continue to menu <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Menu Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-surface p-4 rounded-lg border border-border text-xs">
              <div>
                <div className="font-semibold text-sm text-text">
                  Resolved menu for {employeeDetail?.name}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Showing items on tier <strong className="text-text font-medium">{menuData?.tier?.name}</strong>. Unpriced dishes are automatically hidden.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted tabular-nums">
                  Selected items: <strong className="text-text font-semibold">{orderLines.length}</strong>
                </span>
                <Button
                  disabled={orderLines.length === 0}
                  onClick={() => setStep(3)}
                  size="sm"
                >
                  Configure options ({orderLines.length}) <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>

            {menuLoading ? (
              <div className="py-16 text-center text-muted text-xs">
                Loading resolved menu items…
              </div>
            ) : menuData?.categories?.length > 0 ? (
              <div className="space-y-4">
                {menuData.categories.map((category: any) => (
                  <div key={category.id} className="space-y-2">
                    <div className="border-b border-border pb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-text uppercase tracking-wider">
                        {category.name}
                      </span>
                      <span className="text-muted text-[11px] tabular-nums">
                        {category.dishes?.length || 0} items
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {category.dishes?.map((dish: any) => {
                        const isAdded = orderLines.some((l) => l.dishId === dish.id);
                        return (
                          <div
                            key={dish.id}
                            className={`p-4 bg-surface rounded-lg border transition-colors ${
                              isAdded ? 'border-brand-solid bg-brand-soft' : 'border-border hover:bg-raised'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div>
                                <div className="font-medium text-sm text-text">{dish.name}</div>
                                <div className="text-[11px] font-mono text-muted tabular-nums">SKU: {dish.sku}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold tabular-nums text-text">
                                  {formatCents(dish.priceCents)}
                                </div>
                                {dish.temperature && (
                                  <Chip>{dish.temperature}</Chip>
                                )}
                              </div>
                            </div>

                            {dish.description && (
                              <p className="text-xs text-muted line-clamp-2 mb-2">
                                {dish.description}
                              </p>
                            )}

                            {/* Tags & Allergens */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {dish.dietaryTags?.map((tag: any) => (
                                <Chip key={tag.id}>{tag.name}</Chip>
                              ))}
                              {dish.allergens?.map((all: any) => (
                                <Chip key={all.id}>{all.name}</Chip>
                              ))}
                            </div>

                            <div className="pt-2 border-t border-border flex items-center justify-between">
                              <span className="text-[11px] text-muted tabular-nums">
                                {dish.minOrderQty ? `Min qty: ${dish.minOrderQty}` : 'Min qty: 1'}
                              </span>

                              <Button
                                size="sm"
                                variant={isAdded ? 'secondary' : 'default'}
                                onClick={() => addDishToOrder(dish)}
                                className="h-7 text-xs px-2.5"
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-brand-text" /> Added
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3 mr-1" /> Add
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-muted text-xs bg-surface border border-border rounded-lg">
                No dishes available for this employee on this tier.
              </div>
            )}

            <div className="flex justify-between pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
              </Button>
              <Button disabled={orderLines.length === 0} onClick={() => setStep(3)}>
                Configure options ({orderLines.length} dishes) <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Configure Combinations */}
        {step === 3 && (
          <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
            <div>
              <div className="font-semibold text-sm text-text">Step 3: Quantities & option combinations</div>
              <p className="text-xs text-muted mt-0.5">
                Each order line is cooked in units. Set overall line quantity and specify customization splits.
              </p>
            </div>

            <div className="space-y-4 pt-1">
              {orderLines.map((line, lineIdx) => {
                let dishSchema: any = null;
                if (menuData?.categories) {
                  for (const cat of menuData.categories) {
                    const found = cat.dishes?.find((d: any) => d.id === line.dishId);
                    if (found) {
                      dishSchema = found;
                      break;
                    }
                  }
                }

                const totalComboQty = line.combinations.reduce((sum, c) => sum + c.quantity, 0);
                const isQtyMatched = totalComboQty === line.quantity;

                return (
                  <div key={line.dishId} className="p-4 rounded-lg bg-app border border-border space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <div>
                        <div className="font-medium text-sm text-text">{line.dishName}</div>
                        <div className="text-[11px] text-muted font-mono tabular-nums">
                          SKU: {line.dishSku} · {formatCents(line.dishPriceCents)} / unit
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted">Total units:</label>
                          <input
                            type="number"
                            min={line.minOrderQty || 1}
                            value={line.quantity}
                            onChange={(e) => {
                              const val = Math.max(line.minOrderQty || 1, parseInt(e.target.value, 10) || 1);
                              const updated = [...orderLines];
                              updated[lineIdx].quantity = val;
                              setOrderLines(updated);
                            }}
                            className="w-16 h-8 px-2 bg-surface border border-border rounded text-xs text-text text-right font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-brand-solid"
                          />
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOrderLines(orderLines.filter((_, idx) => idx !== lineIdx));
                          }}
                          className="h-8 px-2 text-danger hover:text-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Combinations Breakdown */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted uppercase tracking-wider text-[11px]">
                          Combination splits ({totalComboQty} / {line.quantity} units assigned)
                        </span>
                        {!isQtyMatched && (
                          <span className="text-danger text-xs font-medium tabular-nums">
                            Must assign exactly {line.quantity} units (diff: {line.quantity - totalComboQty})
                          </span>
                        )}
                      </div>

                      {line.combinations.map((combo, comboIdx) => (
                        <div
                          key={comboIdx}
                          className="p-3 rounded-md bg-surface border border-border space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <label className="text-muted">Units:</label>
                              <input
                                type="number"
                                min={1}
                                max={line.quantity}
                                value={combo.quantity}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  const updated = [...orderLines];
                                  updated[lineIdx].combinations[comboIdx].quantity = val;
                                  setOrderLines(updated);
                                }}
                                className="w-16 h-7 px-2 bg-app border border-border rounded text-xs text-text text-right font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-brand-solid"
                              />
                            </div>

                            {line.combinations.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...orderLines];
                                  updated[lineIdx].combinations = updated[lineIdx].combinations.filter(
                                    (_, idx) => idx !== comboIdx
                                  );
                                  setOrderLines(updated);
                                }}
                                className="text-muted hover:text-danger p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Options Selection for Groups */}
                          {dishSchema?.optionGroups?.map((group: any) => {
                            const currentSel = combo.options.find((o) => o.groupName === group.name);
                            return (
                              <div key={group.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                <div>
                                  <label className="text-[11px] text-muted block mb-1">
                                    {group.name} {group.required ? '*' : '(Optional)'}
                                  </label>
                                  <select
                                    value={currentSel?.optionName || ''}
                                    onChange={(e) => {
                                      const optName = e.target.value;
                                      const updated = [...orderLines];
                                      const comboOpts = [...combo.options].filter((o) => o.groupName !== group.name);
                                      if (optName) {
                                        comboOpts.push({
                                          groupName: group.name,
                                          optionName: optName,
                                          portionName: currentSel?.portionName || null,
                                        });
                                      }
                                      updated[lineIdx].combinations[comboIdx].options = comboOpts;
                                      setOrderLines(updated);
                                    }}
                                    className="w-full h-8 px-2 bg-app border border-border rounded text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                                  >
                                    {!group.required && <option value="">None</option>}
                                    {group.options?.map((opt: any) => (
                                      <option key={opt.id} value={opt.name}>
                                        {opt.name} ({formatCents(opt.priceCents)})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {group.usesPortions && (
                                  <div>
                                    <label className="text-[11px] text-muted block mb-1">
                                      Size / Portion
                                    </label>
                                    <select
                                      value={currentSel?.portionName || ''}
                                      onChange={(e) => {
                                        const pName = e.target.value;
                                        const updated = [...orderLines];
                                        const targetOpt = updated[lineIdx].combinations[comboIdx].options.find(
                                          (o) => o.groupName === group.name
                                        );
                                        if (targetOpt) {
                                          targetOpt.portionName = pName || null;
                                        }
                                        setOrderLines(updated);
                                      }}
                                      className="w-full h-8 px-2 bg-app border border-border rounded text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                                    >
                                      {group.portions?.map((port: any) => (
                                        <option key={port.id} value={port.portionSize?.name}>
                                          {port.portionSize?.name}{' '}
                                          {port.extraCents ? `(+${formatCents(port.extraCents)})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const updated = [...orderLines];
                          const remainingQty = Math.max(1, line.quantity - totalComboQty);
                          const firstComboOpts = line.combinations[0]?.options || [];
                          updated[lineIdx].combinations.push({
                            quantity: remainingQty,
                            options: JSON.parse(JSON.stringify(firstComboOpts)),
                          });
                          setOrderLines(updated);
                        }}
                        className="text-xs h-7"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add split combination
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setStep(2)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to menu
              </Button>
              <Button
                disabled={orderLines.some((l) => {
                  const sum = l.combinations.reduce((s, c) => s + c.quantity, 0);
                  return sum !== l.quantity;
                })}
                onClick={() => setStep(4)}
              >
                Proceed to delivery <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Delivery Details */}
        {step === 4 && (
          <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
            <div>
              <div className="font-semibold text-sm text-text">Step 4: Delivery details & employee permissions</div>
              <p className="text-xs text-muted mt-0.5">
                Configure delivery address, planned delivery time, and packaging according to company permissions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-medium text-text block mb-1">
                  Delivery address *
                </label>
                <select
                  value={addressId}
                  disabled={!employeeDetail?.canChooseAddress && companyDetail?.addresses?.length > 1}
                  onChange={(e) => setAddressId(e.target.value)}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid disabled:opacity-50"
                >
                  {companyDetail?.addresses?.map((addr: any) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label} — {addr.line1}, {addr.city} {addr.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                {!employeeDetail?.canChooseAddress && (
                  <p className="text-[11px] text-muted mt-1">
                    Employee cannot choose custom address (fixed to company default address).
                  </p>
                )}
              </div>

              <div>
                <label className="font-medium text-text block mb-1">
                  Delivery time (kitchen zone) *
                </label>
                <Input
                  type="time"
                  step={300}
                  disabled={!employeeDetail?.canChangeTime}
                  value={minutesToTimeString(deliveryTimeMin)}
                  onChange={(e) => setDeliveryTimeMin(timeStringToMinutes(e.target.value))}
                />
                {!employeeDetail?.canChangeTime && (
                  <p className="text-[11px] text-muted mt-1 tabular-nums">
                    Employee cannot change delivery time (fixed to company default:{' '}
                    {formatMinutesToTime(companyDetail?.defaultDeliveryTimeMin)}).
                  </p>
                )}
              </div>

              <div>
                <label className="font-medium text-text block mb-1">
                  Packaging format *
                </label>
                <select
                  value={packaging}
                  disabled={!employeeDetail?.canChangePackaging}
                  onChange={(e) => setPackaging(e.target.value)}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid disabled:opacity-50"
                >
                  <option value="STANDARD">Standard packaging</option>
                  <option value="INSULATED">Insulated thermal packaging</option>
                  <option value="ECO">Eco-friendly biodegradable</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-text block mb-1">
                  Special delivery instructions (optional)
                </label>
                <Input
                  placeholder="e.g. Leave at 4th floor reception"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setStep(3)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to combinations
              </Button>
              <Button onClick={() => setStep(5)}>
                Review & live validation <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Place */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <div className="font-semibold text-sm text-text">Step 5: Order breakdown & live preview</div>
                  <p className="text-xs text-muted mt-0.5">
                    Live server validation results, allergen cross-checks, and financial snapshot.
                  </p>
                </div>

                <StatusBadge
                  status={previewMutation.data?.valid ? 'Ready' : 'Late'}
                  label={
                    previewMutation.isPending
                      ? 'Validating…'
                      : previewMutation.data?.valid
                      ? 'Validation passed'
                      : 'Validation issues'
                  }
                />
              </div>

              {/* Server Errors if invalid */}
              {previewMutation.data && !previewMutation.data.valid && (
                <div className="p-3.5 rounded-lg bg-raised border border-danger text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-danger">
                    <AlertTriangle className="w-4 h-4" /> Validation errors:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-text">
                    {previewMutation.data.errors?.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Allergen Warning Banner */}
              {previewMutation.data?.warnings?.length > 0 && (
                <div className="p-3.5 rounded-lg bg-raised border border-warning text-xs space-y-2">
                  <div className="font-semibold flex items-center gap-1.5 text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    Allergen warnings detected:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-text">
                    {previewMutation.data.warnings.map((warn: string, i: number) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 pt-1 font-medium text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allergenAcknowledged}
                      onChange={(e) => setAllergenAcknowledged(e.target.checked)}
                      className="rounded bg-app border-border text-brand-solid focus:ring-brand-solid"
                    />
                    <span>I acknowledge the allergen warnings and wish to proceed.</span>
                  </label>
                </div>
              )}

              {/* Order Summary & Pricing Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="md:col-span-2 space-y-2">
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Order lines breakdown
                  </div>

                  <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-app">
                    {previewMutation.data?.lines?.map((line: any, idx: number) => (
                      <div key={idx} className="p-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-text">{line.dishName}</span>
                          <span className="font-semibold tabular-nums text-text">
                            {formatCents(line.lineTotalCents)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted tabular-nums">
                          {line.quantity} units @ base {formatCents(line.dishPriceCents)}
                        </div>

                        {/* Combinations */}
                        <div className="pl-3 border-l-2 border-border space-y-0.5 mt-1 text-[11px] text-muted">
                          {line.combinations?.map((c: any, cIdx: number) => (
                            <div key={cIdx} className="flex justify-between tabular-nums">
                              <span>
                                {c.quantity}x {c.label || 'Standard'}
                              </span>
                              <span>{formatCents(c.totalCents)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Delivery & Total Box */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-app border border-border space-y-2 text-xs">
                    <div className="font-medium text-text">Delivery summary</div>
                    <div className="space-y-1 text-muted text-[11px]">
                      <div><strong className="text-text font-medium">Company:</strong> {companyDetail?.name}</div>
                      <div><strong className="text-text font-medium">Employee:</strong> {employeeDetail?.name}</div>
                      <div><strong className="text-text font-medium">Date:</strong> {formatDate(deliveryDate)}</div>
                      <div><strong className="text-text font-medium">Time:</strong> {formatMinutesToTime(deliveryTimeMin)}</div>
                      <div><strong className="text-text font-medium">Packaging:</strong> {packaging}</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-raised border border-border text-xs space-y-2">
                    <div className="flex justify-between text-muted">
                      <span>Subtotal:</span>
                      <span className="tabular-nums font-medium text-text">{formatCents(previewMutation.data?.totalCents || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-text pt-2 border-t border-border">
                      <span>Total billed:</span>
                      <span className="tabular-nums text-base">
                        {formatCents(previewMutation.data?.totalCents || 0)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted pt-0.5">
                      Billed directly to corporate catering account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button variant="secondary" onClick={() => setStep(4)}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to delivery
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleCreateOrder(false)}
                    loading={submitting}
                  >
                    Save as draft
                  </Button>

                  <Button
                    onClick={() => handleCreateOrder(true)}
                    disabled={previewMutation.data && !previewMutation.data.valid}
                    loading={submitting}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Place order now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
