export interface ApiErrorDetail {
    loc: (string | number)[];
    msg: string;
    type: string;
}

export interface ApiErrorResponse {
    detail?: string | ApiErrorDetail[];
}

export interface AxiosErrorResponse {
    response?: {
        data?: ApiErrorResponse;
        status?: number;
    };
    message: string;
    config?: {
        url?: string;
        method?: string;
    };
}
