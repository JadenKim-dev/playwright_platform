export interface TestCaseDto {
  id: string;
  name: string;
  description: string | null;
  params: Record<string, unknown>;
  expected: Record<string, unknown>;
  tags: string[];
  autoCreated: boolean;
  createdAt: string;
  updatedAt: string;
  /** 최신 성공 배포의 매핑에 이 TC가 존재하는지 서버에서 계산한 값 */
  isActive: boolean;
}

export interface TestCasePatchDto {
  name?: string;
  description?: string | null;
  params?: Record<string, unknown>;
  expected?: Record<string, unknown>;
  tags?: string[];
}

export interface ResolvedTestCaseDto {
  params: Record<string, unknown>;
  expected: Record<string, unknown>;
}
