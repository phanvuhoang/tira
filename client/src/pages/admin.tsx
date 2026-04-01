import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Users,
  Settings,
  Trash2,
  Key,
  Save,
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

async function authFetch(method: string, url: string, body?: any): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

interface UserRecord {
  id: string;
  username: string;
  email?: string;
  role: "admin" | "editor" | "viewer";
  created_at: string;
}

interface RiskWeight {
  indicator_id: string;
  weight: number;
}

const INDICATOR_NAMES: Record<string, string> = {
  "0.1": "Chi phí thuế / Doanh thu",
  "0.2": "Biến động LN kế toán trước thuế / Doanh thu",
  "0.3": "Biến động doanh thu thuần",
  "1.1": "Thuế suất hiệu quả (ETR)",
  "1.2": "Thuế suất hiệu quả gộp",
  "1.3": "Biến động LN kế toán trước thuế",
  "1.4": "Biến động chi phí thuế hiện hành",
  "1.5": "Biên lợi nhuận gộp",
  "1.6": "Biên lợi nhuận hoạt động",
  "1.7": "Biên lợi nhuận sau thuế",
  "2.1": "Tỷ lệ nợ thuế",
  "2.2": "Biến động thuế đầu vào",
  "2.3": "Doanh thu / Vốn Chủ Sở Hữu",
  "2.4": "Lợi nhuận chưa phân phối / Vốn CSH",
  "2.5": "Nợ phải trả / Vốn Chủ Sở Hữu",
  "2.6": "Modified K Co-efficient",
  "2.7": "Beneish M-Score",
  "3.1": "Tỷ trọng giảm trừ DT / DT thuần",
  "3.2": "Tỷ trọng CP bán hàng / DT thuần",
  "3.3": "Tỷ trọng CP quản lý / DT thuần",
  "3.4": "Lãi vay / EBITDA",
  "3.5": "Số ngày tồn kho",
  "3.6": "Số ngày phải thu",
  "3.7": "Tốc độ tăng DT / Tốc độ tăng Giá vốn",
};

const WEIGHT_LABELS: Record<number, string> = {
  5: "Rất cao",
  4: "Cao",
  3: "Trung bình",
  2: "Thấp",
  1: "Rất thấp",
};

const WEIGHT_COLORS: Record<number, string> = {
  5: "hsl(0, 72%, 48%)",
  4: "hsl(25, 90%, 50%)",
  3: "hsl(45, 90%, 50%)",
  2: "hsl(142, 55%, 40%)",
  1: "hsl(215, 20%, 60%)",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Quản trị viên",
  editor: "Biên tập viên",
  viewer: "Xem",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "hsl(0, 72%, 48%)",
  editor: "hsl(183, 85%, 35%)",
  viewer: "hsl(215, 20%, 60%)",
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  // Users state
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersMsg, setUsersMsg] = useState<string | null>(null);

  // Reset password dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Risk weights state
  const [weights, setWeights] = useState<RiskWeight[]>([]);
  const [weightsLoading, setWeightsLoading] = useState(true);
  const [weightsError, setWeightsError] = useState<string | null>(null);
  const [weightsSaving, setWeightsSaving] = useState(false);
  const [weightsSaved, setWeightsSaved] = useState(false);

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    if (activeTab === "weights") loadWeights();
  }, [activeTab]);

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await authFetch("GET", "/api/admin/users");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data.users || data);
    } catch (e: any) {
      setUsersError(e.message || "Không thể tải danh sách người dùng");
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadWeights() {
    setWeightsLoading(true);
    setWeightsError(null);
    try {
      const res = await authFetch("GET", "/api/risk-weights");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setWeights(data.weights || data);
    } catch (e: any) {
      setWeightsError(e.message || "Không thể tải trọng số rủi ro");
    } finally {
      setWeightsLoading(false);
    }
  }

  async function handleChangeRole(userId: string, role: string) {
    setUsersMsg(null);
    try {
      const res = await authFetch("PATCH", `/api/admin/users/${userId}/role`, { role });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: role as any } : u))
      );
      setUsersMsg("Đã cập nhật vai trò.");
      setTimeout(() => setUsersMsg(null), 2000);
    } catch (e: any) {
      setUsersError(e.message || "Lỗi khi cập nhật vai trò");
    }
  }

  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(`Xác nhận xóa người dùng "${username}"?`)) return;
    setUsersMsg(null);
    try {
      const res = await authFetch("DELETE", `/api/admin/users/${userId}`);
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setUsersMsg("Đã xóa người dùng.");
      setTimeout(() => setUsersMsg(null), 2000);
    } catch (e: any) {
      setUsersError(e.message || "Lỗi khi xóa người dùng");
    }
  }

  function openResetDialog(username: string) {
    setResetUsername(username);
    setNewPassword("");
    setResetMsg(null);
    setResetDialogOpen(true);
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      setResetMsg("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await authFetch("POST", "/api/auth/forgot-password", {
        username: resetUsername,
        new_password: newPassword,
      });
      if (!res.ok) throw new Error(await res.text());
      setResetMsg("Đã đặt lại mật khẩu thành công.");
      setTimeout(() => {
        setResetDialogOpen(false);
      }, 1500);
    } catch (e: any) {
      setResetMsg(e.message || "Lỗi khi đặt lại mật khẩu");
    } finally {
      setResetLoading(false);
    }
  }

  function handleWeightChange(indicatorId: string, value: number) {
    setWeights((prev) =>
      prev.map((w) =>
        w.indicator_id === indicatorId ? { ...w, weight: value } : w
      )
    );
    setWeightsSaved(false);
  }

  async function handleSaveWeights() {
    setWeightsSaving(true);
    setWeightsSaved(false);
    setWeightsError(null);
    try {
      const res = await authFetch("PUT", "/api/risk-weights", { weights });
      if (!res.ok) throw new Error(await res.text());
      setWeightsSaved(true);
      setTimeout(() => setWeightsSaved(false), 3000);
    } catch (e: any) {
      setWeightsError(e.message || "Lỗi khi lưu trọng số");
    } finally {
      setWeightsSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="admin-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: "hsl(183, 85%, 20%)" }}
        >
          <Shield className="w-5 h-5" style={{ color: "hsl(183, 85%, 55%)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">Quản trị hệ thống</h1>
          <p className="text-sm text-muted-foreground">Quản lý người dùng và cấu hình hệ thống</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users" data-testid="admin-tab-users">
            <Users className="w-4 h-4 mr-2" />
            Quản lý người dùng
          </TabsTrigger>
          <TabsTrigger value="weights" data-testid="admin-tab-weights">
            <Settings className="w-4 h-4 mr-2" />
            Risk Scoring mặc định
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: Users ===== */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Danh sách người dùng</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadUsers}
                data-testid="btn-refresh-users"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Tải lại
              </Button>
            </CardHeader>
            <CardContent>
              {usersMsg && (
                <Alert className="mb-3" style={{ borderColor: "hsl(142, 55%, 40%)", background: "hsl(142, 55%, 10%)" }}>
                  <CheckCircle2 className="w-4 h-4" style={{ color: "hsl(142, 55%, 50%)" }} />
                  <AlertDescription style={{ color: "hsl(142, 55%, 70%)" }}>{usersMsg}</AlertDescription>
                </Alert>
              )}
              {usersError && (
                <Alert className="mb-3" variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{usersError}</AlertDescription>
                </Alert>
              )}

              {usersLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="users-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên đăng nhập</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Vai trò</TableHead>
                        <TableHead>Ngày tạo</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {user.email || "—"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(val) => handleChangeRole(user.id, val)}
                              data-testid={`role-select-${user.id}`}
                            >
                              <SelectTrigger
                                className="w-40 h-8 text-xs"
                                style={{ borderColor: ROLE_COLORS[user.role] + "60" }}
                              >
                                <SelectValue>
                                  <span style={{ color: ROLE_COLORS[user.role] }}>
                                    {ROLE_LABELS[user.role] || user.role}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Quản trị viên</SelectItem>
                                <SelectItem value="editor">Biên tập viên</SelectItem>
                                <SelectItem value="viewer">Xem</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(user.created_at).toLocaleDateString("vi-VN")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => openResetDialog(user.username)}
                                data-testid={`btn-reset-${user.id}`}
                                title="Đặt lại mật khẩu"
                              >
                                <Key className="w-3.5 h-3.5 mr-1" />
                                Đặt lại MK
                              </Button>
                              {user.role !== "admin" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteUser(user.id, user.username)}
                                  data-testid={`btn-delete-${user.id}`}
                                  title="Xóa người dùng"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Không có người dùng nào
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: Risk Weights ===== */}
        <TabsContent value="weights" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Trọng số rủi ro mặc định</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Điều chỉnh mức độ ưu tiên của từng chỉ số trong tính điểm rủi ro tổng hợp.
                  Mức 5 = quan trọng nhất, Mức 1 = ít quan trọng nhất.
                </p>
              </div>
              <Button
                onClick={handleSaveWeights}
                disabled={weightsSaving}
                data-testid="btn-save-weights"
                style={{
                  background: weightsSaved ? "hsl(142, 55%, 35%)" : "hsl(183, 85%, 25%)",
                  color: "white",
                  border: "none",
                }}
              >
                {weightsSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : weightsSaved ? (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {weightsSaving ? "Đang lưu..." : weightsSaved ? "Đã lưu!" : "Lưu thay đổi"}
              </Button>
            </CardHeader>
            <CardContent>
              {weightsError && (
                <Alert className="mb-3" variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{weightsError}</AlertDescription>
                </Alert>
              )}

              {weightsLoading ? (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2" data-testid="weights-table">
                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    {Object.entries(WEIGHT_LABELS).map(([w, label]) => (
                      <div key={w} className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ background: WEIGHT_COLORS[Number(w)] }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {w} = {label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Group separators */}
                  {[
                    { prefix: "0", label: "CRITICAL RED LINES" },
                    { prefix: "1", label: "DOANH THU - LỢI NHUẬN - THUẾ" },
                    { prefix: "2", label: "RỦI RO NỢ THUẾ - HÓA ĐƠN" },
                    { prefix: "3", label: "VẬN HÀNH - HIỆU QUẢ" },
                  ].map(({ prefix, label }) => {
                    const groupWeights = weights.filter((w) =>
                      w.indicator_id.startsWith(prefix + ".")
                    );
                    if (groupWeights.length === 0) return null;
                    return (
                      <div key={prefix} className="mb-4">
                        <div
                          className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded mb-2"
                          style={{
                            background: "hsl(183, 85%, 10%)",
                            color: "hsl(183, 85%, 55%)",
                          }}
                        >
                          {label}
                        </div>
                        <div className="space-y-2">
                          {groupWeights.map((w) => (
                            <div
                              key={w.indicator_id}
                              className="flex items-center gap-4 px-3 py-2 rounded-lg border"
                              style={{
                                borderColor: "hsl(214, 10%, 80%, 0.3)",
                                background: "hsl(214, 10%, 97%)",
                              }}
                              data-testid={`weight-row-${w.indicator_id}`}
                            >
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] shrink-0 w-10 justify-center"
                              >
                                {w.indicator_id}
                              </Badge>
                              <span className="text-sm flex-1 min-w-0 truncate" title={INDICATOR_NAMES[w.indicator_id]}>
                                {INDICATOR_NAMES[w.indicator_id] || w.indicator_id}
                              </span>
                              <div className="flex items-center gap-3 shrink-0">
                                <Slider
                                  value={[w.weight]}
                                  min={1}
                                  max={5}
                                  step={1}
                                  className="w-32"
                                  onValueChange={([val]) =>
                                    handleWeightChange(w.indicator_id, val)
                                  }
                                  data-testid={`slider-${w.indicator_id}`}
                                />
                                <span
                                  className="text-xs font-semibold w-16 text-right"
                                  style={{ color: WEIGHT_COLORS[w.weight] }}
                                >
                                  {w.weight} – {WEIGHT_LABELS[w.weight]}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent data-testid="reset-password-dialog">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Đặt mật khẩu mới cho người dùng:{" "}
              <strong className="text-foreground">{resetUsername}</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                data-testid="input-new-password"
              />
            </div>
            {resetMsg && (
              <Alert
                style={{
                  borderColor: resetMsg.includes("thành công")
                    ? "hsl(142, 55%, 40%)"
                    : "hsl(0, 72%, 40%)",
                  background: resetMsg.includes("thành công")
                    ? "hsl(142, 55%, 10%)"
                    : "hsl(0, 72%, 10%)",
                }}
              >
                <AlertDescription
                  style={{
                    color: resetMsg.includes("thành công")
                      ? "hsl(142, 55%, 70%)"
                      : "hsl(0, 72%, 70%)",
                  }}
                >
                  {resetMsg}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setResetDialogOpen(false)}
              data-testid="btn-cancel-reset"
            >
              Hủy
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetLoading}
              data-testid="btn-confirm-reset"
            >
              {resetLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Key className="w-4 h-4 mr-2" />
              )}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
