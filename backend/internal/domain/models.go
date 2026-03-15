package domain

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleDoctor Role = "doctor"
)

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	FullName     string `json:"fullName"`
	PasswordHash string `json:"-"`
	Role         Role   `json:"role"`
	TwoFAEnabled bool   `json:"twoFaEnabled"`
}

type Patient struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	BirthDate string `json:"birthDate"`
	Gender    string `json:"gender"`
	Phone     string `json:"phone,omitempty"`
	Email     string `json:"email,omitempty"`
}

type Template struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Modality  string `json:"modality"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

type Protocol struct {
	ID        string    `json:"id"`
	Patient   Patient   `json:"patient"`
	Modality  string    `json:"modality"`
	Template  *Template `json:"template"`
	Content   string    `json:"content"`
	CreatedAt string    `json:"createdAt"`
	UpdatedAt string    `json:"updatedAt"`
	Status    string    `json:"status"`
}

type AuditEvent struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Action    string `json:"action"`
	CreatedAt string `json:"createdAt"`
}
