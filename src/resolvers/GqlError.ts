export class GqlError extends Error {
    public readonly code: number;
    public readonly params?: any;
  
    constructor(code: number, message: string, params?: any) {
      super();
      this.code = code;
      this.message = message;
      this.params = params;
    }
  
  }