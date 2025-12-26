from django.urls import path
from . import views

urlpatterns = [
    path('all_drugs', views.get_all_drugs),
    path('check_interactions', views.check_interactions),
]